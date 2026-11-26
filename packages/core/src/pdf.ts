/**
 * PDF-export: één blad per verdieping, op een vaste schaal (1:50, 1:100 of 1:200),
 * met titelblok, schaalstok, legende van de meetbronnen en disclaimer.
 *
 * Schaal kiezen: de kleinste schaal (dus de grootste tekening) die op het
 * papier past, A4 vóór A3. Een vaste schaal laat toe om met een lat op de
 * afdruk te meten; de schaalstok laat controleren of de printer niet
 * "aan pagina aanpaste".
 */
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { GAS_WAARSCHUWING } from "./installaties.ts";
import { LASTENBOEK_AANNAMES, lastenboek } from "./lastenboek.ts";
import { euro, raming, type Prijzen } from "./prijzen.ts";
import { vloerNetto } from "./bewerken.ts";
import { maatketens, tekstBreedte } from "./maatvoering.ts";
import { openingLabelPunt, openingenLijst, openingLabel } from "./openingen.ts";
import { peilTekst } from "./verdiepingen.ts";
import { binnenmaten, m2Tekst, muurRechthoek, muurVorm, oppervlakte, puntLangsMuur, zwaartepunt } from "./geometrie.ts";
import type { MeetMethode, Project, Punt, Verdieping } from "./schema.ts";

export type Papier = "A4" | "A3";
export type Schaal = 50 | 100 | 200;

export interface PdfOpties {
  /** Vast papierformaat; anders automatisch. */
  papier?: Papier;
  /** Vaste schaal; anders automatisch. */
  schaal?: Schaal;
  /** Datum op het titelblok (ISO); standaard vandaag. */
  datum?: string;
  /** Naam van wie opmat (bv. bedrijfsnaam). */
  opgemetenDoor?: string;
  /** Eenheidsprijzen per post: dan komt er een raming op het lijstenblad. */
  prijzen?: Prijzen;
  /** Btw-tarief voor de raming (%). */
  btwPct?: number;
  /** Eigen tekst in het vak "Belangrijk" (standaard DISCLAIMER). */
  disclaimer?: string;
}

/** Papiermaten liggend, in mm. */
export const PAPIER: Record<Papier, { b: number; h: number }> = {
  A4: { b: 297, h: 210 },
  A3: { b: 420, h: 297 },
};
const VOLGORDE: Array<[Papier, Schaal]> = [
  ["A4", 50], ["A3", 50], ["A4", 100], ["A3", 100], ["A4", 200], ["A3", 200],
];

export const PT = 72 / 25.4; // punten per mm papier
export const RAND = 10; // mm
export const TITELBLOK_H = 42; // mm, strook onderaan

export const DISCLAIMER =
  "Opmeting ter indicatie, opgemaakt met een gsm-scan. Maten te verifiëren ter plaatse vóór uitvoering of bestelling. " +
  "Dit is geen bouwplan voor een omgevingsvergunning en geen stabiliteitsstudie.";

const KLEUR: Record<MeetMethode, RGB> = {
  gescand: rgb(0.706, 0.325, 0.035),
  gecorrigeerd: rgb(0.114, 0.306, 0.847),
  manueel: rgb(0.114, 0.306, 0.847),
  laser: rgb(0.082, 0.502, 0.239),
  overgenomen: rgb(0.47, 0.44, 0.42),
};
const ZWART = rgb(0.16, 0.15, 0.14);
const GRIJS = rgb(0.34, 0.33, 0.31);
const VLOER = rgb(0.96, 0.96, 0.955);
const OPENING = rgb(0.055, 0.455, 0.565);
const WIT = rgb(1, 1, 1);
const HULP = rgb(0.6, 0.58, 0.56);

/** Uitgestrektheid van de tekening in plan-mm, inclusief maatlijnen en hun tekst. */
/** Rijafstanden op papier (mm), omgerekend naar plan-mm voor een schaal. */
const ketenOpties = (schaal: number) => ({ afstand: 8 * schaal, tussen: 7 * schaal });

export function tekenGrenzen(v: Verdieping, schaal: number = 50): { minX: number; minY: number; maxX: number; maxY: number } {
  const pts: Punt[] = v.muren.flatMap((m) => muurVorm(m, v.muren));
  for (const ml of maatketens(v, ketenOpties(schaal))) {
    const extra = 4 * schaal; // maatgetal reikt tot ±3 mm buiten de maatlijn
    pts.push(
      { x: ml.a.x + ml.n.x * extra, y: ml.a.y + ml.n.y * extra },
      { x: ml.b.x + ml.n.x * extra, y: ml.b.y + ml.n.y * extra },
    );
  }
  if (!pts.length) for (const r of v.ruimtes) pts.push(...r.contour);
  if (!pts.length) return { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/** Kiest papier en schaal zodat de tekening past. */
export function kiesBlad(v: Verdieping, opties: PdfOpties = {}): { papier: Papier; schaal: Schaal; past: boolean } {
  const kandidaten = VOLGORDE.filter(([p, s]) => (!opties.papier || p === opties.papier) && (!opties.schaal || s === opties.schaal));
  for (const [papier, schaal] of kandidaten) {
    const g = tekenGrenzen(v, schaal);
    const bw = g.maxX - g.minX, bh = g.maxY - g.minY;
    const { b, h } = PAPIER[papier];
    if (bw / schaal <= b - 2 * RAND && bh / schaal <= h - 2 * RAND - TITELBLOK_H) return { papier, schaal, past: true };
  }
  const [papier, schaal] = kandidaten[kandidaten.length - 1] ?? ["A3", 200];
  return { papier, schaal, past: false };
}

export async function projectNaarPDF(p: Project, opties: PdfOpties = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${p.naam} — plannen bestaande toestand`);
  doc.setSubject("Opmeting ter indicatie");
  doc.setCreator("architect1.0");
  doc.setProducer("architect1.0 (pdf-lib)");
  const fonts = {
    gewoon: await doc.embedFont(StandardFonts.Helvetica),
    vet: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  const datum = opties.datum ?? new Date().toISOString().slice(0, 10);
  if (!opties.disclaimer && p.verdiepingen.some((v) => (v.installaties ?? []).some((x) => x.net === "gas"))) opties = { ...opties, disclaimer: `${GAS_WAARSCHUWING} ${DISCLAIMER}` };
  // Titelblokken pas op het einde tekenen: dan is het totaal aantal bladen gekend.
  const titelblokken: Array<(blad: number, bladen: number) => void> = [];
  for (const v of p.verdiepingen) titelblokken.push(tekenBlad(doc, fonts, p, v, { ...opties, datum }));
  titelblokken.push(...tekenLijsten(doc, fonts, p, { ...opties, datum }, kiesBlad(p.verdiepingen[0]!, opties).papier));
  titelblokken.forEach((teken, i) => teken(i + 1, titelblokken.length));
  return doc.save();
}

export interface Fonts { gewoon: PDFFont; vet: PDFFont }

/** Extra tekenwerk op een planblad (installaties, ontwerp …). */
export interface BladExtra {
  titel?: string;
  disclaimer?: string;
  /** Eigen legende i.p.v. de betrouwbaarheid van de maten. */
  legende?: Array<[RGB, string]>;
  teken?: (c: { page: PDFPage; naar: (q: Punt) => { x: number; y: number }; schaal: number; f: Fonts; lijn: (a: Punt, b: Punt, kleur: RGB, dikteMm: number) => void; H: number }) => void;
}

export function tekenBlad(
  doc: PDFDocument,
  f: Fonts,
  p: Project,
  v: Verdieping,
  opties: PdfOpties & { datum: string },
  extra: BladExtra = {},
): (blad: number, bladen: number) => void {
  const { papier, schaal, past } = kiesBlad(v, opties);
  const { b, h } = PAPIER[papier];
  const page = doc.addPage([b * PT, h * PT]);
  const H = h * PT;

  // --- plan → papier (pt). Tekening gecentreerd in het vak boven het titelblok.
  const g = tekenGrenzen(v, schaal);
  const vakB = b - 2 * RAND, vakH = h - 2 * RAND - TITELBLOK_H;
  const ox = RAND + (vakB - (g.maxX - g.minX) / schaal) / 2;
  const oy = RAND + TITELBLOK_H + (vakH - (g.maxY - g.minY) / schaal) / 2;
  const naar = (q: Punt) => ({ x: (ox + (q.x - g.minX) / schaal) * PT, y: (oy + (q.y - g.minY) / schaal) * PT });

  const veelhoek = (pts: Punt[], vul?: RGB, lijn?: RGB, dikteMm = 0) => {
    const d = pts.map((q, i) => { const r = naar(q); return `${i ? "L" : "M"}${r.x.toFixed(2)},${(H - r.y).toFixed(2)}`; }).join(" ") + " Z";
    page.drawSvgPath(d, { x: 0, y: H, color: vul, borderColor: lijn, borderWidth: lijn ? dikteMm * PT : 0 });
  };
  const lijnPlan = (a: Punt, c: Punt, kleur: RGB, dikteMm: number) =>
    page.drawLine({ start: naar(a), end: naar(c), color: kleur, thickness: dikteMm * PT });

  // --- ruimtes, muren, openingen
  for (const r of v.ruimtes) veelhoek(r.contour, VLOER);
  for (const sp of v.sparingen ?? []) {
    veelhoek(sp.contour, WIT);
    const c = sp.contour;
    for (let k = 0; k < c.length; k++) {
      // streeplijn: 2 mm streep, 1 mm wit
      const a = c[k]!, e = c[(k + 1) % c.length]!;
      const L = Math.hypot(e.x - a.x, e.y - a.y), stap = 3 * schaal;
      for (let d = 0; d < L; d += stap) {
        const d2 = Math.min(L, d + 2 * schaal);
        lijnPlan({ x: a.x + ((e.x - a.x) * d) / L, y: a.y + ((e.y - a.y) * d) / L }, { x: a.x + ((e.x - a.x) * d2) / L, y: a.y + ((e.y - a.y) * d2) / L }, GRIJS, 0.25);
      }
    }
    if (c.length === 4) { lijnPlan(c[0]!, c[2]!, HULP, 0.13); lijnPlan(c[1]!, c[3]!, HULP, 0.13); }
  }
  for (const m of v.muren) veelhoek(muurVorm(m, v.muren), ZWART);
  const muren = new Map(v.muren.map((m) => [m.id, m]));
  for (const o of v.openingen) {
    const m = muren.get(o.muurId);
    if (!m) continue;
    const deel = { ...m, start: puntLangsMuur(m, o.offset), eind: puntLangsMuur(m, o.offset + o.breedte) };
    veelhoek(muurRechthoek(deel), WIT, OPENING, 0.25);
    if (o.soort === "raam") lijnPlan(deel.start, deel.eind, OPENING, 0.25);
  }

  // --- maatlijnen (kleur = meetbron)
  const ketens = maatketens(v, ketenOpties(schaal));
  // hulplijnen: van net naast het gevelvlak tot net voorbij de maatlijn
  for (const ml of ketens) {
    for (const [h, q] of [[ml.hulpA, ml.a], [ml.hulpB, ml.b]] as const) {
      if (!h) continue;
      const n = ml.n;
      lijnPlan({ x: h.x + n.x * 1.5 * schaal, y: h.y + n.y * 1.5 * schaal }, { x: q.x + n.x * 1.2 * schaal, y: q.y + n.y * 1.2 * schaal }, HULP, 0.1);
    }
  }
  // codes bij ramen en deuren (binnendeuren ook met breedte)
  const lijst = new Map(openingenLijst(p).map((r) => [r.id, r]));
  for (const o of v.openingen) {
    const rij = lijst.get(o.id), plek = openingLabelPunt(v, o, 2.2 * schaal);
    if (rij && plek) tekstGecentreerd(page, openingLabel(rij.code, rij), naar(plek.punt), 1.8, f.vet, OPENING, plek.hoek);
  }

  for (const ml of ketens) {
    const kleur = KLEUR[ml.methode];
    const { a, b: e, n } = ml;
    lijnPlan(a, e, kleur, 0.18);
    const tik = 1.2 * schaal; // 1,2 mm op papier
    const u = { x: (e.x - a.x) / ml.lengte, y: (e.y - a.y) / ml.lengte };
    for (const q of [a, e]) {
      lijnPlan({ x: q.x - n.x * tik, y: q.y - n.y * tik }, { x: q.x + n.x * tik, y: q.y + n.y * tik }, kleur, 0.18);
      // schuine streep (architectenconventie)
      const s = { x: (u.x + n.x) * 0.7 * schaal, y: (u.y + n.y) * 0.7 * schaal };
      lijnPlan({ x: q.x - s.x, y: q.y - s.y }, { x: q.x + s.x, y: q.y + s.y }, kleur, 0.35);
    }
    const tekst = `${Math.round(ml.lengte)}`;
    // past het getal niet tussen de streepjes (op papier): kleiner, aan de binnenkant
    const klein = tekstBreedte(tekst, 2.2) > (ml.lengte / schaal) * 0.9;
    const afst = (klein ? -1.6 : 1.8) * schaal;
    const midden = naar({ x: (a.x + e.x) / 2 + n.x * afst, y: (a.y + e.y) / 2 + n.y * afst });
    let hoek = (Math.atan2(e.y - a.y, e.x - a.x) * 180) / Math.PI;
    if (hoek > 90 || hoek <= -90) hoek += 180;
    tekstGecentreerd(page, tekst, midden, klein ? 1.7 : 2.2, ml.rij === 2 ? f.vet : f.gewoon, kleur, hoek);
  }

  for (const sp of v.sparingen ?? []) tekstGecentreerd(page, sp.soort, naar(zwaartepunt(sp.contour)), 1.8, f.gewoon, GRIJS);

  // --- ruimtelabels
  for (const r of v.ruimtes) {
    const c = naar(zwaartepunt(r.contour));
    const m2 = m2Tekst(vloerNetto(r, v));
    tekstGecentreerd(page, r.naam, { x: c.x, y: c.y + 5.5 * PT }, 3.2, f.vet, ZWART);
    tekstGecentreerd(page, `${m2} m²`, c, 2.5, f.gewoon, GRIJS);
    const bm = binnenmaten(r);
    if (bm) tekstGecentreerd(page, `${bm.breedte} × ${bm.diepte}`, { x: c.x, y: c.y - 4.5 * PT }, 2.2, f.gewoon, GRIJS);
  }

  extra.teken?.({ page, naar, schaal, f, lijn: lijnPlan, H });
  tekenPaginaKader(page, b, h);
  const titel = extra.titel ?? `Plan bestaande toestand — ${v.naam} (peil ${peilTekst(v.peil)})`;
  return (blad, bladen) => tekenTitelblok(page, f, p, titel, { papier, schaal, past, blad, bladen, muren: v.muren, ...opties, disclaimer: extra.disclaimer ?? opties.disclaimer, legende: extra.legende }, b);
}

export function tekstGecentreerd(page: PDFPage, s: string, c: { x: number; y: number }, hoogteMm: number, font: PDFFont, kleur: RGB, hoekGraden = 0) {
  const size = hoogteMm * PT / 0.72; // kapitaalhoogte Helvetica ≈ 0,72 × korpsgrootte
  const w = font.widthOfTextAtSize(s, size);
  const a = (hoekGraden * Math.PI) / 180;
  const u = { x: Math.cos(a), y: Math.sin(a) }, n = { x: -Math.sin(a), y: Math.cos(a) };
  const dh = (hoogteMm * PT) / 2;
  page.drawText(s, {
    x: c.x - u.x * (w / 2) - n.x * dh,
    y: c.y - u.y * (w / 2) - n.y * dh,
    size,
    font,
    color: kleur,
    rotate: degrees(hoekGraden),
  });
}

export function tekenPaginaKader(page: PDFPage, b: number, h: number) {
  page.drawRectangle({
    x: (RAND / 2) * PT, y: (RAND / 2) * PT, width: (b - RAND) * PT, height: (h - RAND) * PT,
    borderColor: ZWART, borderWidth: 0.5 * PT,
  });
}

export function tekenTitelblok(
  page: PDFPage,
  f: Fonts,
  p: Project,
  titel: string,
  o: PdfOpties & { datum: string; papier: Papier; schaal?: Schaal; past: boolean; blad: number; bladen: number; muren?: Verdieping["muren"]; legende?: Array<[RGB, string]> },
  b: number,
) {
  const x0 = RAND / 2, y0 = RAND / 2, w = b - RAND, hb = TITELBLOK_H - 2;
  const mm = (q: number) => q * PT;
  const lijn = (x1: number, y1: number, x2: number, y2: number) =>
    page.drawLine({ start: { x: mm(x1), y: mm(y1) }, end: { x: mm(x2), y: mm(y2) }, thickness: mm(0.3), color: ZWART });
  const tekst = (s: string, x: number, y: number, size = 8, font = f.gewoon, kleur = ZWART) =>
    page.drawText(s, { x: mm(x), y: mm(y), size, font, color: kleur });
  const label = (s: string, x: number, y: number) => tekst(s.toUpperCase(), x, y, 5.5, f.gewoon, GRIJS);

  lijn(x0, y0 + hb, x0 + w, y0 + hb);
  const kolDisc = 82, kolLeg = 52, kolSchaal = 60;
  const xDisc = x0 + w - kolDisc, xLeg = xDisc - kolLeg, xSchaal = xLeg - kolSchaal;
  for (const x of [xSchaal, xLeg, xDisc]) lijn(x, y0, x, y0 + hb);

  // Project
  const adres = [p.adres?.straat, [p.adres?.postcode, p.adres?.gemeente].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  label("Project", x0 + 3, y0 + hb - 5);
  tekst(afkappen(p.naam, f.vet, 11, xSchaal - x0 - 6), x0 + 3, y0 + hb - 11, 11, f.vet);
  if (adres) tekst(afkappen(adres, f.gewoon, 8, xSchaal - x0 - 6), x0 + 3, y0 + hb - 16);
  label("Blad", x0 + 3, y0 + hb - 22);
  tekst(afkappen(titel, f.vet, 9, xSchaal - x0 - 6), x0 + 3, y0 + hb - 27, 9, f.vet);
  label("Datum", x0 + 3, y0 + 9);
  tekst(o.datum, x0 + 3, y0 + 4);
  label("Blad nr.", x0 + 26, y0 + 9);
  tekst(`${o.blad} / ${o.bladen}`, x0 + 26, y0 + 4);
  if (o.opgemetenDoor) {
    label("Opgemeten door", x0 + 44, y0 + 9);
    tekst(afkappen(o.opgemetenDoor, f.gewoon, 8, xSchaal - x0 - 47), x0 + 44, y0 + 4);
  }

  // Schaal + schaalstok
  label("Schaal", xSchaal + 3, y0 + hb - 5);
  if (!o.schaal) {
    tekst(`Geen schaal  —  ${o.papier} liggend`, xSchaal + 3, y0 + hb - 11, 11, f.vet);
    tekst("Lijsten bij de plannen", xSchaal + 3, y0 + hb - 16, 7, f.gewoon, GRIJS);
  } else {
  tekst(`1:${o.schaal}  —  ${o.papier} liggend`, xSchaal + 3, y0 + hb - 11, 11, f.vet);
  if (!o.past) tekst("Tekening groter dan blad!", xSchaal + 3, y0 + hb - 16, 7, f.vet, rgb(0.75, 0.1, 0.1));
  tekst("Maten in mm", xSchaal + 3, y0 + hb - 16 - (o.past ? 0 : 4), 7, f.gewoon, GRIJS);
  // schaalstok: 5 m
  // elk vakje = 10 mm op papier: 0,5 m bij 1:50, 1 m bij 1:100, 2 m bij 1:200
  const stapM = o.schaal / 100;
  const stappen = 5;
  const stapMm = (stapM * 1000) / o.schaal;
  const sx = xSchaal + 3, sy = y0 + 9;
  for (let i = 0; i < stappen; i++) {
    page.drawRectangle({
      x: mm(sx + i * stapMm), y: mm(sy), width: mm(stapMm), height: mm(1.6),
      color: i % 2 ? WIT : ZWART, borderColor: ZWART, borderWidth: mm(0.2),
    });
  }
  for (let i = 0; i <= stappen; i++) tekst(`${i * stapM}`.replace(".", ","), sx + i * stapMm - 0.8, sy - 4, 6);
  tekst("m", sx + stappen * stapMm + 2.5, sy - 4, 6);
  label("Controle afdruk: schaalstok nameten", sx, sy + 4);
  }

  // Legende meetbronnen
  label(o.legende ? "Legende" : o.schaal ? "Betrouwbaarheid maten" : "Hoeveelheden", xLeg + 3, y0 + hb - 5);
  if (!o.schaal && !o.legende) regels("Ter indicatie, berekend uit de opmeting. Aannames: zie lijst.", f.gewoon, 7.5, 52 - 6).forEach((r, i) => tekst(r, xLeg + 3, y0 + hb - 12 - i * 3.6, 7.5));
  const legende: Array<[MeetMethode, string]> = [
    ["gescand", "Gescand (± enkele cm)"],
    ["gecorrigeerd", "Gecorrigeerd / ingegeven"],
    ["laser", "Lasermeting (± 2 mm)"],
    ["overgenomen", "Overgenomen, niet gemeten"],
  ];
  const rijen: Array<[RGB, string]> = o.legende ?? legende.map(([m, s]) => [KLEUR[m], s]);
  if (o.schaal || o.legende) rijen.slice(0, 6).forEach(([k, s], i) => {
    const y = y0 + hb - 12 - i * (o.legende ? 5 : 6);
    page.drawLine({ start: { x: mm(xLeg + 3), y: mm(y + 1) }, end: { x: mm(xLeg + 11), y: mm(y + 1) }, thickness: mm(0.6), color: k });
    tekst(afkappen(s, f.gewoon, 7, kolLeg - 15), xLeg + 13, y, 7);
  });
  const dragend = (o.muren ?? []).some((m) => m.dragend === "vermoeden");
  if (dragend) tekst("Dragende muren: niet vastgesteld", xLeg + 3, y0 + 4, 6.5, f.gewoon, GRIJS);

  // Disclaimer
  label("Belangrijk", xDisc + 3, y0 + hb - 5);
  const disc = o.disclaimer ?? DISCLAIMER;
  let grootte = 7, stap = 3.4;
  let lijnen = regels(disc, f.gewoon, grootte, kolDisc - 6);
  while (lijnen.length * stap > hb - 9 && grootte > 4.6) { grootte -= 0.4; stap = grootte * 0.47; lijnen = regels(disc, f.gewoon, grootte, kolDisc - 6); }
  const vetDisc = /^GAS|GAS:/.test(disc) || disc.includes("GAS:");
  lijnen.forEach((r, i) => tekst(r, xDisc + 3, y0 + hb - 10 - i * stap, grootte, f.gewoon, vetDisc ? rgb(0.55, 0.25, 0) : ZWART));
}

export function afkappen(s: string, font: PDFFont, size: number, maxMm: number): string {
  const max = maxMm * PT;
  if (font.widthOfTextAtSize(s, size) <= max) return s;
  while (s.length > 1 && font.widthOfTextAtSize(s + "…", size) > max) s = s.slice(0, -1);
  return s + "…";
}

export function regels(s: string, font: PDFFont, size: number, maxMm: number): string[] {
  const uit: string[] = [];
  let huidig = "";
  for (const woord of s.split(" ")) {
    const kandidaat = huidig ? `${huidig} ${woord}` : woord;
    if (font.widthOfTextAtSize(kandidaat, size) > maxMm * PT && huidig) {
      uit.push(huidig);
      huidig = woord;
    } else huidig = kandidaat;
  }
  if (huidig) uit.push(huidig);
  return uit;
}

// ---------------------------------------------------------------------------
// Lijstenbladen: openingenlijst, meetstaat per post, detail per ruimte.

interface Kolom { kop: string; breedte: number; rechts?: boolean }

function tekenLijsten(doc: PDFDocument, f: Fonts, p: Project, opties: PdfOpties & { datum: string }, papier: Papier): Array<(blad: number, bladen: number) => void> {
  const { b, h } = PAPIER[papier];
  const mm = (q: number) => q * PT;
  const titelblokken: Array<(blad: number, bladen: number) => void> = [];
  const tussen = 8;
  const kolB = (b - 2 * RAND - tussen) / 2;
  const boven = h - RAND - 4, onder = RAND + TITELBLOK_H + 2;
  const RIJ = 4.2;
  let page!: PDFPage, kol = 0, y = 0;

  const nieuweBlad = () => {
    page = doc.addPage([b * PT, h * PT]);
    tekenPaginaKader(page, b, h);
    const pg = page;
    titelblokken.push((blad, bladen) => tekenTitelblok(pg, f, p, "Lijsten — openingen en meetstaat", { papier, past: true, blad, bladen, ...opties }, b));
    kol = 0;
    y = boven;
  };
  const x0 = () => RAND + kol * (kolB + tussen);
  const plaats = (nodig: number) => {
    if (y - nodig >= onder) return;
    if (kol === 0) { kol = 1; y = boven; return; }
    nieuweBlad();
  };
  const tekst = (s: string, x: number, yy: number, size: number, font: PDFFont, kleur = ZWART) =>
    page.drawText(s, { x: mm(x), y: mm(yy), size, font, color: kleur });
  const kop = (s: string) => {
    plaats(14);
    y -= 6;
    tekst(s, x0(), y, 10, f.vet);
    y -= 2;
  };
  const rij = (kolommen: Kolom[], waarden: string[], vet = false) => {
    plaats(RIJ + 1);
    y -= RIJ;
    let x = x0();
    kolommen.forEach((k, i) => {
      const font = vet ? f.vet : f.gewoon;
      const w = afkappen(waarden[i] ?? "", font, 7.5, k.breedte - 1.5);
      const tx = k.rechts ? x + k.breedte - 1.5 - font.widthOfTextAtSize(w, 7.5) / PT : x;
      tekst(w, tx, y + 1.2, 7.5, font);
      x += k.breedte;
    });
    if (vet) page.drawLine({ start: { x: mm(x0()), y: mm(y) }, end: { x: mm(x0() + kolB), y: mm(y) }, thickness: mm(0.25), color: ZWART });
  };
  const tabel = (kolommen: Kolom[], rijen: string[][]) => {
    rij(kolommen, kolommen.map((k) => k.kop), true);
    for (const r of rijen) {
      if (y - (RIJ + 1) < onder) { plaats(RIJ * 2 + 2); rij(kolommen, kolommen.map((k) => k.kop), true); }
      rij(kolommen, r);
    }
  };
  const getal = (x: number, d = 2) => x.toFixed(d).replace(".", ",");

  const openingen = openingenLijst(p);
  const lb = lastenboek(p);
  if (!openingen.length && !lb.regels.length && !p.notities?.trim()) return [];
  nieuweBlad();

  if (openingen.length) {
    kop("Openingenlijst (maten in mm)");
    const meerdere = p.verdiepingen.length > 1;
    const k: Kolom[] = [
      { kop: "Code", breedte: 12 }, { kop: "Soort", breedte: 17 },
      ...(meerdere ? [{ kop: "Verdieping", breedte: 24 }] : []),
      { kop: "Ruimte(s)", breedte: meerdere ? 37 : 61 },
      { kop: "Breedte", breedte: 14, rechts: true }, { kop: "Hoogte", breedte: 14, rechts: true },
      { kop: "Borstw.", breedte: 14, rechts: true },
    ];
    tabel(k, openingen.map((o) => [
      o.code, o.soort, ...(meerdere ? [o.verdieping] : []), o.ruimtes.join(" / "),
      String(o.breedte), String(o.hoogte), o.soort === "raam" ? String(o.borstwering) : "–",
    ]));
  }

  const metPrijzen = opties.prijzen && lb.totalen.some((t) => opties.prijzen![t.code] !== undefined);
  if (lb.totalen.length && metPrijzen) {
    const r = raming(lb, opties.prijzen!, opties.btwPct ?? 21);
    kop("Raming per post (excl. btw)");
    const k: Kolom[] = [
      { kop: "Post", breedte: 10 }, { kop: "Omschrijving", breedte: 52 }, { kop: "Eenh.", breedte: 11 },
      { kop: "Hoev.", breedte: 17, rechts: true }, { kop: "Prijs", breedte: 20, rechts: true }, { kop: "Bedrag", breedte: 24, rechts: true },
    ];
    tabel(k, r.regels.map((x) => [
      x.code, x.omschrijving, x.eenheid, x.eenheid === "st" ? String(x.hoeveelheid) : getal(x.hoeveelheid),
      x.eenheidsprijs === undefined ? "–" : euro(x.eenheidsprijs), x.bedrag === undefined ? "–" : euro(x.bedrag),
    ]));
    rij(k, ["", "Totaal excl. btw", "", "", "", euro(r.exclBtw)], true);
    rij(k, ["", `Btw ${r.btwPct} %`, "", "", "", euro(r.btw)]);
    rij(k, ["", "Totaal incl. btw", "", "", "", euro(r.inclBtw)], true);
    if (r.zonderPrijs.length) rij(k, ["", `Zonder prijs: post ${r.zonderPrijs.join(", ")}`, "", "", "", ""]);
  } else if (lb.totalen.length) {
    kop("Meetstaat per post (totalen)");
    tabel(
      [{ kop: "Post", breedte: 12 }, { kop: "Omschrijving", breedte: 80 }, { kop: "Eenh.", breedte: 14 }, { kop: "Hoeveelheid", breedte: 26, rechts: true }],
      lb.totalen.map((t) => [t.code, t.omschrijving, t.eenheid, t.eenheid === "st" ? String(t.hoeveelheid) : getal(t.hoeveelheid)]),
    );
  }
  if (lb.totalen.length) {
    kop("Detail per ruimte");
    const meerdere = p.verdiepingen.length > 1;
    tabel(
      [{ kop: "Ruimte", breedte: meerdere ? 44 : 44 }, { kop: "Post", breedte: 62 }, { kop: "Eenh.", breedte: 12 }, { kop: "Hoev.", breedte: 14, rechts: true }],
      lb.regels.map((r) => [meerdere ? `${r.ruimte} (${r.verdieping})` : r.ruimte, `${r.code} ${r.omschrijving}`, r.eenheid, r.eenheid === "st" ? String(r.hoeveelheid) : getal(r.hoeveelheid)]),
    );
  }

  // notities van de werf
  const notities: Array<[string, string]> = [];
  if (p.notities?.trim()) notities.push(["Project", p.notities.trim()]);
  for (const v of p.verdiepingen) for (const r of v.ruimtes) if (r.notities?.trim()) notities.push([p.verdiepingen.length > 1 ? `${r.naam} (${v.naam})` : r.naam, r.notities.trim()]);
  if (notities.length) {
    kop("Notities van de werf");
    for (const [wie, wat] of notities) {
      const lijnen = wat.split("\n").flatMap((l) => regels(l, f.gewoon, 7.5, kolB - 32));
      plaats(lijnen.length * 3.6 + 2);
      y -= 4.2;
      tekst(afkappen(wie, f.vet, 7.5, 30), x0(), y + 1.2, 7.5, f.vet);
      lijnen.forEach((l, i) => { if (i) { plaats(3.6); y -= 3.6; } tekst(l, x0() + 32, y + 1.2, 7.5, f.gewoon); });
    }
  }

  // aannames
  const regelsTekst = regels(LASTENBOEK_AANNAMES, f.gewoon, 7, kolB);
  plaats(regelsTekst.length * 3.4 + 8);
  y -= 6;
  tekst("Aannames", x0(), y, 8, f.vet, GRIJS);
  for (const r of regelsTekst) { y -= 3.4; tekst(r, x0(), y, 7, f.gewoon, GRIJS); }
  return titelblokken;
}
