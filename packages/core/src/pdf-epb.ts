/**
 * PDF: EPC/EPB-inventaris (invoerlijst per richting) als voorbereiding op de
 * officiële software. Geen EPC-score; geen oordeel "conform".
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { EPB_DISCLAIMER, epbInventaris } from "./epb.ts";
import { lijstBladen } from "./pdf-lijst.ts";
import { kiesBlad, tekenBlad, type Fonts, type PdfOpties } from "./pdf.ts";
import type { Project } from "./schema.ts";

const g = (x: number | null | undefined, d = 2) => (x === null || x === undefined ? "–" : x.toFixed(d).replace(".", ","));

export async function epbNaarPDF(p: Project, opties: PdfOpties = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${p.naam} — EPB/EPC-inventaris`);
  doc.setCreator("architect1.0");
  const f: Fonts = { gewoon: await doc.embedFont(StandardFonts.Helvetica), vet: await doc.embedFont(StandardFonts.HelveticaBold) };
  const datum = opties.datum ?? new Date().toISOString().slice(0, 10);
  const o = { ...opties, datum, disclaimer: EPB_DISCLAIMER };
  const titelblokken: Array<(blad: number, bladen: number) => void> = [];
  const noord = p.noord ?? 0;
  for (const v of p.verdiepingen) {
    titelblokken.push(tekenBlad(doc, f, p, v, o, {
      titel: `EPB-inventaris — ${v.naam} (noorden: ${noord}°)`,
      teken: ({ page, H }) => {
        // noordpijl rechtsboven
        const cx = page.getWidth() - 40, cy = H - 40, r = 16, a = (noord * Math.PI) / 180;
        const rot = (x: number, y: number) => ({ x: cx + x * Math.cos(-a) - y * Math.sin(-a), y: cy + x * Math.sin(-a) + y * Math.cos(-a) });
        page.drawCircle({ x: cx, y: cy, size: r, borderColor: rgb(0.16, 0.15, 0.14), borderWidth: 1 });
        const pts = [rot(0, r * 0.85), rot(r * 0.35, -r * 0.5), rot(0, -r * 0.25), rot(-r * 0.35, -r * 0.5)];
        page.drawSvgPath(pts.map((q, i) => `${i ? "L" : "M"}${q.x.toFixed(1)},${(-q.y).toFixed(1)}`).join(" ") + " Z", { x: 0, y: 0, color: rgb(0.16, 0.15, 0.14) });
        const n = rot(0, r * 1.25);
        page.drawText("N", { x: n.x - 3, y: n.y - 3, size: 9, font: f.vet });
      },
    }));
  }
  const inv = epbInventaris(p);
  const lijst = lijstBladen(doc, f, p, o, kiesBlad(p.verdiepingen[0]!, opties).papier, "EPB/EPC-inventaris — invoerlijst", ["Status", "Inventaris; de energiedeskundige controleert en rekent."]);
  lijst.kop("Beschermd volume");
  lijst.tabel([{ kop: "", breedte: 90 }, { kop: "Waarde", breedte: 30, rechts: true }], [
    ["Netto binnenvolume (m³)", g(inv.volume)],
    ["Netto vloeroppervlakte (m²)", g(inv.vloeroppervlakte)],
    ["Noorden op het plan (°, met de klok mee)", String(noord)],
  ]);
  lijst.kop("Oppervlaktes per richting (m², grenzend aan buiten)");
  lijst.tabel([{ kop: "Richting", breedte: 30 }, { kop: "Muren", breedte: 30, rechts: true }, { kop: "Ramen", breedte: 30, rechts: true }, { kop: "Deuren", breedte: 30, rechts: true }],
    inv.perRichting.map((x) => [x.richting, g(x.muren), g(x.ramen), g(x.deuren)]));
  lijst.kop("Elementen");
  lijst.tabel([{ kop: "Element", breedte: 44 }, { kop: "Grens", breedte: 18 }, { kop: "Richt.", breedte: 12 }, { kop: "m²", breedte: 14, rechts: true }, { kop: "U", breedte: 14, rechts: true }, { kop: "Herkomst", breedte: 20 }, { kop: "Foto's", breedte: 12, rechts: true }],
    inv.regels.map((x) => [`${x.verdieping}: ${x.element}`, x.grens, x.richting ?? "", g(x.oppervlakte), g(x.u, 3), x.herkomst, String(x.fotos)]));
  const details = inv.regels.filter((x) => x.isolatie || x.extra || x.bron);
  if (details.length) {
    lijst.kop("Samenstelling, glas, kader, bron");
    for (const x of details) lijst.alinea(`${x.verdieping}: ${x.element} — ${[x.isolatie && `isolatie: ${x.isolatie}`, x.extra, x.bron && `bron: ${x.bron}`].filter(Boolean).join("; ")}`);
  }
  if (inv.ontbrekend.length) {
    lijst.kop("Nog in te vullen");
    for (const x of inv.ontbrekend) lijst.alinea(`• ${x}`, { kleur: rgb(0.6, 0.2, 0.05) });
  }
  lijst.kop("Meetregels en beperkingen");
  lijst.alinea("Muren: buitenlengte × verdiepingshoogte min openingen. Vloer en dak: netto vloeroppervlakte. De EPB-software gebruikt eigen meetregels (buitenafmetingen): na te kijken door de energiedeskundige.");
  lijst.alinea("U-waarde: vereenvoudigd volgens NBN EN ISO 6946 (Rsi 0,13 muur, 0,10 dak, 0,17 vloer; Rse 0,04 naar buiten), zonder koudebruggen, bevestigingen of grondcorrectie. Raam: Uw ≈ 0,7·Ug + 0,3·Uf zonder randverlies. λ-waarden zijn richtwaarden tenzij een bron vermeld is.");
  lijst.alinea(EPB_DISCLAIMER, { vet: true });
  titelblokken.push(...lijst.titelblokken);
  titelblokken.forEach((t, i) => t(i + 1, titelblokken.length));
  return doc.save();
}
