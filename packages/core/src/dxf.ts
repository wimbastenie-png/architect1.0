/**
 * DXF-export (AutoCAD R12 ASCII — het breedst ondersteunde formaat:
 * AutoCAD, BricsCAD, DraftSight, LibreCAD, QCAD).
 * Eenheden: millimeter. Lagen: MUREN, OPENINGEN, RUIMTES, MATEN, TEKST.
 */
import { maatketens } from "./maatvoering.ts";
import { binnenmaten, muurRechthoek, muurVorm, oppervlakte, puntLangsMuur, zwaartepunt } from "./geometrie.ts";
import type { Punt, Verdieping } from "./schema.ts";

const LAGEN: Record<string, number> = { MUREN: 7, OPENINGEN: 4, RUIMTES: 8, MATEN: 1, TEKST: 3 };

class Dxf {
  private r: string[] = [];
  g(code: number, waarde: string | number) {
    this.r.push(String(code), typeof waarde === "number" ? fmt(waarde) : waarde);
  }
  lijn(laag: string, a: Punt, b: Punt) {
    this.g(0, "LINE");
    this.g(8, laag);
    this.g(10, a.x); this.g(20, a.y); this.g(30, 0);
    this.g(11, b.x); this.g(21, b.y); this.g(31, 0);
  }
  polylijn(laag: string, pts: Punt[], gesloten = true) {
    this.g(0, "POLYLINE");
    this.g(8, laag);
    this.g(66, 1);
    this.g(10, 0); this.g(20, 0); this.g(30, 0);
    this.g(70, gesloten ? 1 : 0);
    for (const p of pts) {
      this.g(0, "VERTEX");
      this.g(8, laag);
      this.g(10, p.x); this.g(20, p.y); this.g(30, 0);
    }
    this.g(0, "SEQEND");
    this.g(8, laag);
  }
  tekst(laag: string, p: Punt, hoogte: number, s: string, hoekGraden = 0) {
    this.g(0, "TEXT");
    this.g(8, laag);
    this.g(10, p.x); this.g(20, p.y); this.g(30, 0);
    this.g(40, hoogte);
    this.g(1, s);
    if (hoekGraden) this.g(50, hoekGraden);
    // horizontaal + verticaal centreren
    this.g(72, 1); this.g(73, 2);
    this.g(11, p.x); this.g(21, p.y); this.g(31, 0);
  }
  toString() {
    return this.r.join("\r\n") + "\r\n";
  }
}

const fmt = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(3));

export function verdiepingNaarDXF(v: Verdieping, opties: { tekstHoogte?: number } = {}): string {
  const th = opties.tekstHoogte ?? 150; // 150 mm ≈ 3 mm op papier bij 1:50
  const d = new Dxf();

  // HEADER: eenheden mm ($INSUNITS 4)
  d.g(0, "SECTION"); d.g(2, "HEADER");
  d.g(9, "$ACADVER"); d.g(1, "AC1009");
  d.g(9, "$INSUNITS"); d.g(70, 4);
  d.g(0, "ENDSEC");

  // TABLES: lagen
  d.g(0, "SECTION"); d.g(2, "TABLES");
  d.g(0, "TABLE"); d.g(2, "LAYER"); d.g(70, Object.keys(LAGEN).length);
  for (const [naam, kleur] of Object.entries(LAGEN)) {
    d.g(0, "LAYER"); d.g(2, naam); d.g(70, 0); d.g(62, kleur); d.g(6, "CONTINUOUS");
  }
  d.g(0, "ENDTAB");
  d.g(0, "ENDSEC");

  d.g(0, "SECTION"); d.g(2, "ENTITIES");
  const muren = new Map(v.muren.map((m) => [m.id, m]));

  for (const m of v.muren) d.polylijn("MUREN", muurVorm(m, v.muren));

  for (const ml of maatketens(v)) {
    const { a, b, n } = ml;
    d.lijn("MATEN", a, b);
    for (const q of [a, b]) d.lijn("MATEN", { x: q.x - n.x * 100, y: q.y - n.y * 100 }, { x: q.x + n.x * 100, y: q.y + n.y * 100 });
    let hoek = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    if (hoek > 90 || hoek <= -90) hoek += 180; // tekst nooit ondersteboven
    d.tekst("MATEN", { x: (a.x + b.x) / 2 + n.x * th, y: (a.y + b.y) / 2 + n.y * th }, th, `${Math.round(ml.lengte)}`, hoek);
  }

  for (const o of v.openingen) {
    const m = muren.get(o.muurId);
    if (!m) continue;
    const p1 = puntLangsMuur(m, o.offset);
    const p2 = puntLangsMuur(m, o.offset + o.breedte);
    const deel = { ...m, start: p1, eind: p2 };
    d.polylijn("OPENINGEN", muurRechthoek(deel));
    if (o.soort === "raam") d.lijn("OPENINGEN", p1, p2);
  }

  for (const r of v.ruimtes) {
    d.polylijn("RUIMTES", r.contour);
    const c = zwaartepunt(r.contour);
    const m2 = (oppervlakte(r.contour) / 1e6).toFixed(2).replace(".", ",");
    const bm = binnenmaten(r);
    d.tekst("TEKST", { x: c.x, y: c.y + th * 1.2 }, th * 1.3, r.naam);
    d.tekst("TEKST", { x: c.x, y: c.y - th * 0.4 }, th, `${m2} m²`);
    if (bm) d.tekst("TEKST", { x: c.x, y: c.y - th * 1.8 }, th, `${bm.breedte} x ${bm.diepte}`);
  }

  d.g(0, "ENDSEC");
  d.g(0, "EOF");
  return d.toString();
}
