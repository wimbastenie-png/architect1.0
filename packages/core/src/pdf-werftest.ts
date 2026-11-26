/** Nauwkeurigheidsrapport (werftestprotocol) als A4-lijst met titelblok. */
import { PDFDocument, StandardFonts } from "pdf-lib";
import { lijstBladen } from "./pdf-lijst.ts";
import type { Fonts, PdfOpties } from "./pdf.ts";
import type { Project } from "./schema.ts";
import { METHODE, SOORT_MAAT, WERFTEST_DISCLAIMER, werftestRapport } from "./werftest.ts";

const g = (x: number) => String(x).replace(".", ",");
const teken = (x: number) => (x > 0 ? `+${x}` : String(x));

export async function werftestNaarPDF(p: Project, opties: PdfOpties = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${p.naam} — nauwkeurigheidsrapport`);
  doc.setCreator("architect1.0");
  const f: Fonts = { gewoon: await doc.embedFont(StandardFonts.Helvetica), vet: await doc.embedFont(StandardFonts.HelveticaBold) };
  const datum = opties.datum ?? new Date().toISOString().slice(0, 10);
  const r = werftestRapport(p);
  const t = r.werftest;
  const lijst = lijstBladen(doc, f, p, { ...opties, datum, disclaimer: WERFTEST_DISCLAIMER }, "A4", "Nauwkeurigheidsrapport (werftestprotocol)", ["Methode", METHODE[t.methode]]);
  lijst.kop("Samenvatting");
  lijst.tabel([{ kop: "", breedte: 0.6 }, { kop: "", breedte: 0.4, rechts: true }], [
    ["Opmeting van het plan", METHODE[t.methode]],
    ["Tolerantie", `± ${g(t.tolerantie)} mm`],
    ["Aantal controlemetingen", String(r.totaal.n)],
    ["Binnen de tolerantie", `${r.totaal.binnen} van ${r.totaal.n} (${r.totaal.binnenPct} %)`],
    ["Gemiddeld verschil (plan − gemeten)", `${teken(r.totaal.gemiddeld)} mm`],
    ["Gemiddeld absoluut verschil", `${g(r.totaal.gemiddeldAbs)} mm`],
    ["Kwadratisch gemiddelde (RMS)", `${g(r.totaal.rms)} mm`],
    ["Grootste afwijking", `${r.totaal.max} mm`],
    ...(t.door ? [["Controle door", t.door]] : []),
  ]);
  if (r.perSoort.length) {
    lijst.kop("Per soort maat");
    lijst.tabel([{ kop: "Soort", breedte: 0.36 }, { kop: "n", breedte: 0.1, rechts: true }, { kop: "gem.", breedte: 0.14, rechts: true }, { kop: "RMS", breedte: 0.14, rechts: true }, { kop: "max", breedte: 0.12, rechts: true }, { kop: "binnen", breedte: 0.14, rechts: true }],
      r.perSoort.map((x) => [SOORT_MAAT[x.soort], String(x.stat.n), teken(x.stat.gemiddeld), g(x.stat.rms), String(x.stat.max), `${x.stat.binnenPct} %`]));
  }
  lijst.kop("Controlemetingen (mm)");
  lijst.tabel([{ kop: "Maat", breedte: 0.4 }, { kop: "Plan", breedte: 0.14, rechts: true }, { kop: "Gemeten", breedte: 0.16, rechts: true }, { kop: "Verschil", breedte: 0.16, rechts: true }, { kop: "", breedte: 0.14 }],
    r.resultaten.map((x) => [x.naam, String(x.model), String(x.meting.gemeten), teken(x.verschil), x.binnen ? "binnen" : "BUITEN"]));
  if (r.opmerkingen.length) { lijst.kop("Opmerkingen"); for (const o of r.opmerkingen) lijst.alinea(o); }
  lijst.kop("Werkwijze");
  lijst.alinea("Elke controlemeting is gedaan met een rolmeter of laser, los van de opmeting van het plan. Verschil = maat in het plan min gemeten maat: positief = plan groter. Binnenmaten van muur tot muur (afgewerkt), plafondhoogte van afgewerkte vloer tot plafond, openingen in de dagkant.");
  lijst.alinea(WERFTEST_DISCLAIMER, { vet: true });
  lijst.titelblokken.forEach((tb, i) => tb(i + 1, lijst.titelblokken.length));
  return doc.save();
}
