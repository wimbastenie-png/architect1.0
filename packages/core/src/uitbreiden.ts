/**
 * Een woning kamer per kamer opbouwen: een nieuwe rechthoekige ruimte
 * tegen een bestaande muur zetten. Die muur wordt de tussenmuur.
 */
import { aansluitingen, muurLengte, planMidden, zwaartepunt } from "./geometrie.ts";
import type { Bron, Muur, Opening, Punt, Ruimte, Verdieping } from "./schema.ts";

export interface NieuweRuimte {
  /** Muur waartegen de nieuwe ruimte komt (wordt tussenmuur). */
  muurId: string;
  naam: string;
  /** Binnenmaat langs de muur (mm). */
  breedte: number;
  /** Binnenmaat loodrecht op de muur (mm). */
  diepte: number;
  /** Afstand van binnenhoek A (start van de muur) tot de nieuwe ruimte (mm). Standaard 0. */
  afstandVanafA?: number;
  /** Dikte van de drie nieuwe muren (mm). Standaard de dikte van de tussenmuur. */
  muurdikte?: number;
  plafondhoogte: number;
  methode?: "manueel" | "laser";
}

const SNAP = 1; // mm: binnen deze afstand van een muuruiteinde → geen splitsing

export function voegRuimteToe(v: Verdieping, i: NieuweRuimte): Verdieping {
  const m = v.muren.find((x) => x.id === i.muurId);
  if (!m) throw new Error(`Muur '${i.muurId}' bestaat niet.`);
  const buren = v.ruimtes.filter((r) => r.muurIds.includes(m.id));
  if (buren.length >= 2) throw new Error("Deze muur ligt al tussen twee ruimtes. Kies een buitenmuur.");
  const B = Math.round(i.breedte), D = Math.round(i.diepte), H = Math.round(i.plafondhoogte);
  const a0 = Math.round(i.afstandVanafA ?? 0);
  const d = Math.round(i.muurdikte ?? m.dikte);
  if (!(B > 0 && D > 0 && H > 0 && d > 0)) throw new Error("Breedte, diepte, hoogte en muurdikte moeten groter dan 0 zijn.");
  if (a0 < 0) throw new Error("De afstand vanaf hoek A kan niet negatief zijn.");

  const L = muurLengte(m);
  const u = { x: (m.eind.x - m.start.x) / L, y: (m.eind.y - m.start.y) / L };
  // normaal weg van de bestaande ruimte (of weg van het midden van het plan)
  let n = { x: -u.y, y: u.x };
  const ref = buren[0] ? zwaartepunt(buren[0].contour) : planMidden(v);
  const mid = { x: (m.start.x + m.eind.x) / 2, y: (m.start.y + m.eind.y) / 2 };
  if ((ref.x - mid.x) * n.x + (ref.y - mid.y) * n.y > 0) n = { x: -n.x, y: -n.y };

  const aans = aansluitingen(m, v.muren);
  const binnen = L - aans.start - aans.eind;
  if (a0 + B > binnen + SNAP)
    throw new Error(`De nieuwe ruimte past niet langs deze muur: ${a0} + ${B} > binnenmaat ${Math.round(binnen)} mm.`);

  // posities langs de muur (gemeten vanaf m.start) van de twee nieuwe zijmuren
  // Valt een zijmuur voorbij het uiteinde van de muur (bv. de nieuwe ruimte
  // sluit aan op een dunnere tussenmuur), dan wordt die zijmuur het verlengde
  // van de muur daar: hartlijn op het uiteinde, dikte zodat de binnenmaat klopt.
  let s1 = aans.start + a0 - d / 2, d1 = d;
  let s2 = aans.start + a0 + B + d / 2, d2 = d;
  if (s1 < SNAP) { d1 = Math.round(2 * (aans.start + a0)); s1 = 0; }
  if (s2 > L - SNAP) { d2 = Math.round(2 * (L - (aans.start + a0 + B))); s2 = L; }
  if (d1 <= 0 || d2 <= 0)
    throw new Error("De nieuwe ruimte loopt tot in de hoek van de bestaande muren. Kies een kleinere breedte of afstand.");

  const P = (s: number, t: number): Punt => ({
    x: Math.round(m.start.x + u.x * s + n.x * t),
    y: Math.round(m.start.y + u.y * s + n.y * t),
  });
  const tVer = m.dikte / 2 + D + d / 2; // hartlijn van de verre muur

  // binnencontour van de nieuwe ruimte
  const c0 = aans.start + a0, c1 = c0 + B, t0 = m.dikte / 2, t1 = t0 + D;
  let contour = [P(c0, t0), P(c1, t0), P(c1, t1), P(c0, t1)];
  if (oppervlakteTeken(contour) < 0) contour = contour.reverse();
  controleerOverlap(v, contour);

  const ids = new Set([...v.muren.map((x) => x.id), ...v.ruimtes.map((x) => x.id), ...v.openingen.map((x) => x.id)]);
  const nieuwId = (basis: string) => {
    let k = 1;
    while (ids.has(`${basis}-${k}`)) k++;
    const id = `${basis}-${k}`;
    ids.add(id);
    return id;
  };

  // bestaande muur splitsen waar de zijmuren aansluiten
  const knip = [0, s1, s2, L].filter((x, k, a) => a.indexOf(x) === k).sort((a, b) => a - b);
  const stukken: Array<{ muur: Muur; van: number; tot: number }> = [];
  for (let k = 0; k < knip.length - 1; k++) {
    const van = knip[k]!, tot = knip[k + 1]!;
    stukken.push({
      muur: {
        ...m,
        id: knip.length === 2 ? m.id : k === 0 ? m.id : nieuwId(m.id),
        start: k === 0 ? m.start : P(van, 0),
        eind: k === knip.length - 2 ? m.eind : P(tot, 0),
      },
      van,
      tot,
    });
  }
  const openingen: Opening[] = v.openingen.map((o) => {
    if (o.muurId !== m.id) return o;
    const stuk = stukken.find((s) => o.offset >= s.van - SNAP && o.offset + o.breedte <= s.tot + SNAP);
    if (!stuk)
      throw new Error(`Een ${o.soort} in deze muur ligt over de plaats van een nieuwe zijmuur. Verplaats of verwijder ze eerst.`);
    return { ...o, muurId: stuk.muur.id, offset: Math.max(0, Math.round(o.offset - stuk.van)) };
  });

  const bron: Bron = { methode: i.methode ?? "manueel", nauwkeurigheidMm: i.methode === "laser" ? 2 : 5 };
  const hoogte = Math.max(H, m.hoogte);
  // Staat er al een muur op exact dezelfde plaats (buurruimte met dezelfde
  // diepte), dan wordt die hergebruikt. Gedeeltelijke overlap → weigeren.
  const bestaand = (a: Punt, b: Punt): Muur | null => {
    for (const w of v.muren) {
      const gelijk = (p: Punt, q: Punt) => p.x === q.x && p.y === q.y;
      if ((gelijk(w.start, a) && gelijk(w.eind, b)) || (gelijk(w.start, b) && gelijk(w.eind, a))) return w;
      if (overlaptCollineair(w.start, w.eind, a, b))
        throw new Error(`Er staat al een muur op de plaats van een nieuwe muur. Geef de nieuwe ruimte dezelfde diepte als de buurruimte, of voeg ze toe via die muur.`);
    }
    return null;
  };
  const nieuw = (start: Punt, eind: Punt, basis: string, dikte: number): { muur: Muur; nieuw: boolean } => {
    const b = bestaand(start, eind);
    if (b) return { muur: b, nieuw: false };
    return { muur: { id: nieuwId(basis), start, eind, dikte, hoogte, dragend: "onbekend", bron }, nieuw: true };
  };
  const z1 = nieuw(P(s1, 0), P(s1, tVer), "m-zij", d1);
  const vr = nieuw(P(s1, tVer), P(s2, tVer), "m-ver", d);
  const z2 = nieuw(P(s2, tVer), P(s2, 0), "m-zij", d2);
  const zij1 = z1.muur, ver = vr.muur, zij2 = z2.muur;
  const toegevoegd = [z1, vr, z2].filter((x) => x.nieuw).map((x) => x.muur);

  // de tussenmuur-stukken die de nieuwe ruimte raken
  const tussen = stukken.filter((s) => s.van >= s1 - SNAP && s.tot <= s2 + SNAP).map((s) => s.muur.id);
  const stukIds = stukken.map((s) => s.muur.id);

  const ruimte: Ruimte = {
    id: nieuwId("r"),
    naam: i.naam.trim() || "Nieuwe ruimte",
    contour,
    plafondhoogte: H,
    muurIds: [...tussen, zij1.id, ver.id, zij2.id],
    bron,
  };

  return {
    ...v,
    muren: [...v.muren.flatMap((x) => (x.id === m.id ? stukken.map((s) => s.muur) : [x])), ...toegevoegd],
    openingen,
    ruimtes: [
      ...v.ruimtes.map((r) =>
        r.muurIds.includes(m.id) ? { ...r, muurIds: r.muurIds.flatMap((id) => (id === m.id ? stukIds : [id])) } : r,
      ),
      ruimte,
    ],
  };
}

/** Liggen twee segmenten op dezelfde lijn en overlappen ze over meer dan SNAP? */
function overlaptCollineair(a: Punt, b: Punt, c: Punt, d: Punt): boolean {
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  if (L === 0) return false;
  const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
  const afstandTotLijn = (p: Punt) => Math.abs((p.x - a.x) * uy - (p.y - a.y) * ux);
  if (afstandTotLijn(c) > SNAP || afstandTotLijn(d) > SNAP) return false;
  const t = (p: Punt) => (p.x - a.x) * ux + (p.y - a.y) * uy;
  const [c1, c2] = [t(c), t(d)].sort((x, y) => x - y) as [number, number];
  return Math.min(L, c2) - Math.max(0, c1) > SNAP;
}

function oppervlakteTeken(c: Punt[]): number {
  let s = 0;
  for (let k = 0; k < c.length; k++) {
    const a = c[k]!, b = c[(k + 1) % c.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

function binnen(p: Punt, c: Punt[]): boolean {
  let in_ = false;
  for (let k = 0, j = c.length - 1; k < c.length; j = k++) {
    const a = c[k]!, b = c[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) in_ = !in_;
  }
  return in_;
}

/** Weigert een ruimte die over een bestaande ruimte zou vallen. */
function controleerOverlap(v: Verdieping, contour: Punt[]) {
  const z = zwaartepunt(contour);
  // punten iets naar binnen getrokken, zodat aanrakende randen niet tellen
  const proef = [z, ...contour.map((p) => ({ x: p.x + (z.x - p.x) * 0.02, y: p.y + (z.y - p.y) * 0.02 }))];
  for (const r of v.ruimtes) {
    const rz = zwaartepunt(r.contour);
    const rproef = [rz, ...r.contour.map((p) => ({ x: p.x + (rz.x - p.x) * 0.02, y: p.y + (rz.y - p.y) * 0.02 }))];
    if (proef.some((p) => binnen(p, r.contour)) || rproef.some((p) => binnen(p, contour)))
      throw new Error(`De nieuwe ruimte overlapt met '${r.naam}'.`);
  }
}
