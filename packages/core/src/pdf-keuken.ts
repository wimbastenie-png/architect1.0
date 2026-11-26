/**
 * PDF keuken en maatwerk: per wand het wandaanzicht op schaal (1:10 tot 1:50),
 * daarna kastenlijst, werkblad, snijlijst en opmerkingen.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { beschikbaar, controleerKeuken, kastDiepte, kastHoogte, KEUKEN_DISCLAIMER, naamKast, snijlijst, wandAanzicht, werkblad, zoekWand, type Maatwerk } from "./keuken.ts";
import { tekeningBlad } from "./pdf-ontwerp.ts";
import { lijstBladen } from "./pdf-lijst.ts";
import type { Fonts, PdfOpties } from "./pdf.ts";
import type { Project } from "./schema.ts";

export async function keukenNaarPDF(p: Project, wanden: Maatwerk[] = p.maatwerk, opties: PdfOpties = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${p.naam} — keuken en maatwerk`);
  doc.setCreator("architect1.0");
  const f: Fonts = { gewoon: await doc.embedFont(StandardFonts.Helvetica), vet: await doc.embedFont(StandardFonts.HelveticaBold) };
  const datum = opties.datum ?? new Date().toISOString().slice(0, 10);
  const o = { ...opties, datum, disclaimer: KEUKEN_DISCLAIMER };
  const titelblokken: Array<(blad: number, bladen: number) => void> = [];
  const legende: Array<[ReturnType<typeof rgb>, string]> = [[rgb(0.27, 0.25, 0.24), "Kasten (maten in mm)"], [rgb(0.05, 0.45, 0.56), "Ramen en deuren"], [rgb(0.86, 0.15, 0.15), "Naad werkblad"], [rgb(0.49, 0.23, 0.93), "Elektriciteit"], [rgb(0.15, 0.39, 0.92), "Water"]];
  for (const w of wanden) titelblokken.push(tekeningBlad(doc, f, p, wandAanzicht(p, w), o, "A4", `Wandaanzicht ${wandAanzicht(p, w).titel}`, [10, 20, 25, 50], legende));
  const lijst = lijstBladen(doc, f, p, o, "A4", "Keuken en maatwerk — lijsten", ["Status", "Voorbereiding; maten na te meten vóór productie."]);
  for (const w of wanden) {
    const wand = zoekWand(p, w);
    if (!wand) continue;
    const bs = beschikbaar(w, wand);
    lijst.kop(`${wand.ruimte.naam} — wand ${w.rand + 1}`);
    lijst.tabel([{ kop: "Meting", breedte: 70 }, { kop: "mm / °", breedte: 30, rechts: true }], [
      ["Lengte volgens het model", String(wand.lengte)],
      ["Gemeten bij de vloer / midden / plafond", [w.meting.onder, w.meting.midden, w.meting.boven].map((x) => x ?? "–").join(" / ")],
      ["Beschikbaar (kleinste maat)", `${bs.breedte} (${bs.bron})`],
      ["Hoek links / rechts uit haaks", `${w.meting.hoekLinks ?? "–"} / ${w.meting.hoekRechts ?? "–"}`],
      ["Vloer: verschil over de wand / muur uit het lood", `${w.meting.vloerVerschil ?? "–"} / ${w.meting.lood ?? "–"}`],
      ["Meetmethode", w.meting.methode],
    ]);
    lijst.tabel([{ kop: "Kast", breedte: 52 }, { kop: "x", breedte: 16, rechts: true }, { kop: "b", breedte: 16, rechts: true }, { kop: "h", breedte: 16, rechts: true }, { kop: "d", breedte: 16, rechts: true }],
      w.kasten.slice().sort((a, b) => a.x - b.x).map((k) => [naamKast(k), String(k.x), String(k.breedte), String(kastHoogte(k)), String(kastDiepte(k))]));
    for (const s of werkblad(w)) lijst.alinea(`Werkblad van ${s.van} tot ${s.tot} mm (${s.lengte} mm)${s.naden.length ? `, naden op ${s.naden.join(", ")} mm` : ""}${s.uitsparingen.length ? `; uitsparingen: ${s.uitsparingen.map((u) => `${u.voor} ${Math.round(u.breedte)} × ${u.diepte} op ${Math.round(u.x)} mm`).join(", ")}` : ""}.`);
    lijst.kop("Snijlijst (vereenvoudigd)");
    lijst.tabel([{ kop: "Onderdeel", breedte: 54 }, { kop: "Materiaal", breedte: 24 }, { kop: "l", breedte: 14, rechts: true }, { kop: "b", breedte: 14, rechts: true }, { kop: "d", breedte: 10, rechts: true }, { kop: "st", breedte: 10, rechts: true }],
      snijlijst(w).map((x) => [x.onderdeel, x.materiaal, String(x.lengte), String(x.breedte), String(x.dikte), String(x.aantal)]));
    const opm = controleerKeuken(p, w);
    if (opm.length) { lijst.kop("Opmerkingen"); for (const x of opm) lijst.alinea(`${x.ernst === "let op" ? "LET OP" : "Info"}: ${x.tekst}`, { kleur: x.ernst === "let op" ? rgb(0.6, 0.2, 0.05) : rgb(0.34, 0.33, 0.31) }); }
  }
  lijst.alinea(KEUKEN_DISCLAIMER, { vet: true });
  titelblokken.push(...lijst.titelblokken);
  titelblokken.forEach((t, i) => t(i + 1, titelblokken.length));
  return doc.save();
}
