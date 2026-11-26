/**
 * Offerte en vorderingsstaat als staand A4-document met logo en firmagegevens.
 */
import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFPage } from "pdf-lib";
import { VAKMAN_ZIN } from "./lastenboek.ts";
import { regels as breek, pdfTekst, type Fonts } from "./pdf.ts";
import { euro } from "./prijzen.ts";
import type { Prijzen } from "./prijzen.ts";
import type { Project } from "./schema.ts";
import { BTW6_VOORWAARDEN, offerteRegels, vorderingsstaat, type Firma, type OfferteInvoer } from "./werf.ts";

const PT = 72 / 25.4;
const ZWART = rgb(0.11, 0.1, 0.09), GRIJS = rgb(0.4, 0.38, 0.36), LIJN = rgb(0.85, 0.84, 0.82);
const g2 = (x: number) => x.toFixed(2).replace(".", ",");

interface Doc { doc: PDFDocument; f: Fonts; pagina: PDFPage; y: number; logo?: PDFImage; firma: Firma; titel: string; nr: number }

async function nieuw(firma: Firma, titel: string): Promise<Doc> {
  const doc = await PDFDocument.create();
  doc.setTitle(titel);
  doc.setCreator("architect1.0");
  const f: Fonts = { gewoon: await doc.embedFont(StandardFonts.Helvetica), vet: await doc.embedFont(StandardFonts.HelveticaBold) };
  let logo: PDFImage | undefined;
  if (firma.logo?.startsWith("data:image/")) {
    try {
      const bytes = Uint8Array.from(atob(firma.logo.split(",")[1]!), (c) => c.charCodeAt(0));
      logo = firma.logo.startsWith("data:image/png") ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    } catch { /* logo onleesbaar: zonder logo verder */ }
  }
  const d: Doc = { doc, f, pagina: null as unknown as PDFPage, y: 0, logo, firma, titel, nr: 0 };
  blad(d);
  return d;
}

function tekst(d: Doc, s: string, x: number, y: number, size = 9, vet = false, kleur = ZWART) {
  d.pagina.drawText(pdfTekst(s), { x: x * PT, y: y * PT, size, font: vet ? d.f.vet : d.f.gewoon, color: kleur });
}
function rechts(d: Doc, s: string, x: number, y: number, size = 9, vet = false) {
  const t = pdfTekst(s), w = (vet ? d.f.vet : d.f.gewoon).widthOfTextAtSize(t, size) / PT;
  tekst(d, t, x - w, y, size, vet);
}

function blad(d: Doc) {
  d.pagina = d.doc.addPage([210 * PT, 297 * PT]);
  d.nr++;
  let y = 282;
  if (d.logo) {
    const h = 18, w = Math.min(60, (d.logo.width / d.logo.height) * h);
    d.pagina.drawImage(d.logo, { x: 15 * PT, y: (y - h + 4) * PT, width: w * PT, height: (w / (d.logo.width / d.logo.height)) * PT });
  }
  const fx = 195, fr = [d.firma.naam, d.firma.adres, d.firma.btw && `Btw ${d.firma.btw}`, d.firma.iban && `IBAN ${d.firma.iban}`, [d.firma.telefoon, d.firma.email].filter(Boolean).join(" · ")].filter((x): x is string => !!x);
  fr.forEach((r, i) => rechts(d, r, fx, y - i * 4.2, i === 0 ? 11 : 8, i === 0));
  y -= Math.max(24, fr.length * 4.2 + 6);
  d.pagina.drawLine({ start: { x: 15 * PT, y: y * PT }, end: { x: 195 * PT, y: y * PT }, thickness: 0.5, color: LIJN });
  // voet
  tekst(d, `${d.titel} — blad ${d.nr}`, 15, 10, 7, false, GRIJS);
  tekst(d, VAKMAN_ZIN, 15, 6.5, 6.5, false, GRIJS);
  d.y = y - 8;
}

function plaats(d: Doc, nodig: number) { if (d.y - nodig < 22) blad(d); }

function alinea(d: Doc, s: string, size = 8.5, vet = false, kleur = ZWART) {
  for (const r of breek(s, vet ? d.f.vet : d.f.gewoon, size, 180)) { plaats(d, 5); tekst(d, r, 15, d.y, size, vet, kleur); d.y -= size * 0.46; }
  d.y -= 2;
}

const KOL = { code: 15, oms: 35, eenh: 125, hoev: 150, prijs: 172, bedrag: 195 };

function tabelKop(d: Doc, kol: Array<[string, number, boolean]>) {
  plaats(d, 12);
  for (const [s, x, r] of kol) (r ? rechts : tekst)(d, s, x, d.y, 8, true);
  d.y -= 2;
  d.pagina.drawLine({ start: { x: 15 * PT, y: d.y * PT }, end: { x: 195 * PT, y: d.y * PT }, thickness: 0.5, color: ZWART });
  d.y -= 4.5;
}

export async function offerteNaarPDF(p: Project, prijzen: Prijzen, firma: Firma, o: OfferteInvoer): Promise<Uint8Array> {
  const d = await nieuw(firma, `Offerte ${o.nummer}`);
  tekst(d, `OFFERTE ${o.nummer}`, 15, d.y, 16, true);
  rechts(d, `Datum: ${o.datum.split("-").reverse().join("/")}`, 195, d.y, 9);
  d.y -= 9;
  tekst(d, "Voor:", 15, d.y, 8, false, GRIJS); tekst(d, o.klant, 30, d.y, 10, true); d.y -= 4.5;
  if (o.klantAdres) { tekst(d, o.klantAdres, 30, d.y, 9); d.y -= 4.5; }
  tekst(d, "Werf:", 15, d.y, 8, false, GRIJS); tekst(d, `${p.naam}${p.adres?.straat ? `, ${p.adres.straat} ${p.adres.postcode ?? ""} ${p.adres.gemeente ?? ""}` : ""}`, 30, d.y, 9); d.y -= 9;
  const { regels, zonderPrijs, excl } = offerteRegels(p, prijzen);
  const kol: Array<[string, number, boolean]> = [["Post", KOL.code, false], ["Omschrijving", KOL.oms, false], ["Eenh.", KOL.eenh, false], ["Hoev.", KOL.hoev, true], ["Prijs", KOL.prijs, true], ["Bedrag", KOL.bedrag, true]];
  tabelKop(d, kol);
  let groep: string | undefined;
  for (const r of regels) {
    if (r.groep !== groep) { groep = r.groep; plaats(d, 9); tekst(d, (groep ?? "").toUpperCase(), 15, d.y, 7.5, true, GRIJS); d.y -= 4.5; }
    const lijnen = breek(r.omschrijving, d.f.gewoon, 8.5, KOL.eenh - KOL.oms - 3);
    plaats(d, lijnen.length * 4 + 1);
    tekst(d, r.code, KOL.code, d.y, 8.5);
    lijnen.forEach((l, i) => tekst(d, l, KOL.oms, d.y - i * 4, 8.5));
    tekst(d, r.eenheid, KOL.eenh, d.y, 8.5);
    rechts(d, r.eenheid === "st" ? String(r.hoeveelheid) : g2(r.hoeveelheid), KOL.hoev, d.y, 8.5);
    rechts(d, euro(r.prijs), KOL.prijs, d.y, 8.5);
    rechts(d, euro(r.bedrag), KOL.bedrag, d.y, 8.5);
    d.y -= lijnen.length * 4 + 1.2;
  }
  plaats(d, 24);
  d.pagina.drawLine({ start: { x: 120 * PT, y: (d.y + 2) * PT }, end: { x: 195 * PT, y: (d.y + 2) * PT }, thickness: 0.5, color: ZWART });
  const btw = Math.round(excl * o.btwPct) / 100;
  for (const [l, b, vet] of [["Totaal excl. btw", excl, false], [`Btw ${o.btwPct} %`, btw, false], ["Totaal incl. btw", excl + btw, true]] as const) {
    tekst(d, l, 122, d.y - 2, 9.5, vet); rechts(d, euro(b), 195, d.y - 2, 9.5, vet); d.y -= 5.5;
  }
  d.y -= 4;
  if (zonderPrijs.length) alinea(d, `Niet in deze offerte (geen eenheidsprijs): post ${zonderPrijs.join(", ")}.`, 8, false, GRIJS);
  if (o.btwPct === 6) { alinea(d, "Btw 6 %", 9, true); alinea(d, BTW6_VOORWAARDEN, 8); }
  alinea(d, "Betaling", 9, true); alinea(d, o.betaling, 8.5);
  alinea(d, "Geldigheid", 9, true); alinea(d, `Deze offerte is ${o.geldigheidDagen} dagen geldig vanaf de datum hierboven.`, 8.5);
  alinea(d, "Hoeveelheden", 9, true); alinea(d, "Hoeveelheden berekend uit de opmeting, ter indicatie; vóór uitvoering na te meten. Verrekening volgens de werkelijk uitgevoerde hoeveelheden.", 8.5);
  if (o.opmerking) { alinea(d, "Opmerking", 9, true); alinea(d, o.opmerking, 8.5); }
  plaats(d, 30);
  d.y -= 6;
  tekst(d, "Voor akkoord (datum, naam en handtekening klant):", 15, d.y, 9, true);
  tekst(d, `Voor ${firma.naam}:`, 115, d.y, 9, true);
  d.y -= 22;
  d.pagina.drawLine({ start: { x: 15 * PT, y: d.y * PT }, end: { x: 95 * PT, y: d.y * PT }, thickness: 0.5, color: GRIJS });
  d.pagina.drawLine({ start: { x: 115 * PT, y: d.y * PT }, end: { x: 195 * PT, y: d.y * PT }, thickness: 0.5, color: GRIJS });
  return d.doc.save();
}

export async function vorderingsstaatNaarPDF(p: Project, prijzen: Prijzen, firma: Firma, nr: number, btwPct: 6 | 21): Promise<Uint8Array> {
  const d = await nieuw(firma, `Vorderingsstaat ${nr} — ${p.naam}`);
  const staat = p.vorderingen.find((x) => x.nr === nr);
  tekst(d, `VORDERINGSSTAAT ${nr}`, 15, d.y, 16, true);
  rechts(d, `Datum: ${(staat?.datum ?? "").split("-").reverse().join("/")}`, 195, d.y, 9);
  d.y -= 8; tekst(d, `Werf: ${p.naam}`, 15, d.y, 9); d.y -= 8;
  const v = vorderingsstaat(p, prijzen, nr);
  const kol: Array<[string, number, boolean]> = [["Post", 15, false], ["Omschrijving", 32, false], ["Bedrag", 118, true], ["Vorig %", 136, true], ["Nu %", 152, true], ["Uitgevoerd", 174, true], ["Deze staat", 195, true]];
  tabelKop(d, kol);
  for (const r of v.regels) {
    const l = breek(r.omschrijving, d.f.gewoon, 8, 80)[0] ?? "";
    plaats(d, 5);
    tekst(d, r.code, 15, d.y, 8); tekst(d, l, 32, d.y, 8);
    rechts(d, euro(r.bedrag), 118, d.y, 8); rechts(d, `${Math.round(r.vorigProcent)} %`, 136, d.y, 8); rechts(d, `${Math.round(r.procent)} %`, 152, d.y, 8);
    rechts(d, euro(r.uitgevoerd), 174, d.y, 8); rechts(d, euro(r.dezeStaat), 195, d.y, 8);
    d.y -= 4.4;
  }
  plaats(d, 30);
  d.y -= 2;
  const btw = Math.round(v.dezeStaat * btwPct) / 100;
  for (const [lbl, b, vet] of [["Totaal uitgevoerd (cumulatief)", v.totaalUitgevoerd, false], ["Vorige staten", v.vorigTotaal, false], ["Deze staat excl. btw", v.dezeStaat, true], [`Btw ${btwPct} %`, btw, false], ["Deze staat incl. btw", v.dezeStaat + btw, true]] as const) {
    tekst(d, lbl, 112, d.y, 9, vet); rechts(d, euro(b), 195, d.y, 9, vet); d.y -= 5.2;
  }
  d.y -= 4;
  alinea(d, "Percentages = uitgevoerd deel van elke post (cumulatief), bepaald door de aannemer en na te kijken door de klant of zijn architect.", 8, false, GRIJS);
  return d.doc.save();
}
