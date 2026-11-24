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
import { binnenmaten, maatlijnen, muurRechthoek, muurVorm, oppervlakte, puntLangsMuur, zwaartepunt } from "./geometrie.ts";
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
}

/** Papiermaten liggend, in mm. */
const PAPIER: Record<Papier, { b: number; h: number }> = {
  A4: { b: 297, h: 210 },
  A3: { b: 420, h: 297 },
};
const VOLGORDE: Array<[Papier, Schaal]> = [
  ["A4", 50], ["A3", 50], ["A4", 100], ["A3", 100], ["A4", 200], ["A3", 200],
];

const PT = 72 / 25.4; // punten per mm papier
const RAND = 10; // mm
const TITELBLOK_H = 42; // mm, strook onderaan

export const DISCLAIMER =
  "Opmeting ter indicatie, opgemaakt met een gsm-scan. Maten te verifiëren ter plaatse vóór uitvoering of bestelling. " +
  "Dit is geen bouwplan voor een omgevingsvergunning en geen stabiliteitsstudie.";

const KLEUR: Record<MeetMethode, RGB> = {
  gescand: rgb(0.706, 0.325, 0.035),
  gecorrigeerd: rgb(0.114, 0.306, 0.847),
  manueel: rgb(0.114, 0.306, 0.847),
  laser: rgb(0.082, 0.502, 0.239),
};
const ZWART = rgb(0.16, 0.15, 0.14);
const GRIJS = rgb(0.34, 0.33, 0.31);
const VLOER = rgb(0.96, 0.96, 0.955);
const OPENING = rgb(0.055, 0.455, 0.565);
const WIT = rgb(1, 1, 1);

/** Uitgestrektheid van de tekening in plan-mm, inclusief maatlijnen en hun tekst. */
export function tekenGrenzen(v: Verdieping): { minX: number; minY: number; maxX: number; maxY: number } {
  const pts: Punt[] = v.muren.flatMap((m) => muurVorm(m, v.muren));
  for (const ml of maatlijnen(v)) {
    const extra = 500; // ruimte voor het maatgetal buiten de maatlijn
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
  const g = tekenGrenzen(v);
  const bw = g.maxX - g.minX, bh = g.maxY - g.minY;
  const kandidaten = VOLGORDE.filter(([p, s]) => (!opties.papier || p === opties.papier) && (!opties.schaal || s === opties.schaal));
  for (const [papier, schaal] of kandidaten) {
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
  p.verdiepingen.forEach((v, i) => {
    tekenBlad(doc, fonts, p, v, { ...opties, datum }, i + 1, p.verdiepingen.length);
  });
  return doc.save();
}

interface Fonts { gewoon: PDFFont; vet: PDFFont }

function tekenBlad(
  doc: PDFDocument,
  f: Fonts,
  p: Project,
  v: Verdieping,
  opties: PdfOpties & { datum: string },
  blad: number,
  bladen: number,
) {
  const { papier, schaal, past } = kiesBlad(v, opties);
  const { b, h } = PAPIER[papier];
  const page = doc.addPage([b * PT, h * PT]);
  const H = h * PT;

  // --- plan → papier (pt). Tekening gecentreerd in het vak boven het titelblok.
  const g = tekenGrenzen(v);
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
  for (const ml of maatlijnen(v)) {
    const kleur = KLEUR[ml.methode];
    const { a, b: e, n } = ml;
    lijnPlan(a, e, kleur, 0.18);
    const tik = 1.2 * schaal; // 1,2 mm op papier
    for (const q of [a, e]) {
      lijnPlan({ x: q.x - n.x * tik, y: q.y - n.y * tik }, { x: q.x + n.x * tik, y: q.y + n.y * tik }, kleur, 0.18);
      // schuine streep (architectenconventie)
      const u = { x: (e.x - a.x) / ml.lengte, y: (e.y - a.y) / ml.lengte };
      const s = { x: (u.x + n.x) * 0.7 * schaal, y: (u.y + n.y) * 0.7 * schaal };
      lijnPlan({ x: q.x - s.x, y: q.y - s.y }, { x: q.x + s.x, y: q.y + s.y }, kleur, 0.35);
    }
    const midden = naar({ x: (a.x + e.x) / 2 + n.x * 1.8 * schaal, y: (a.y + e.y) / 2 + n.y * 1.8 * schaal });
    let hoek = (Math.atan2(e.y - a.y, e.x - a.x) * 180) / Math.PI;
    if (hoek > 90 || hoek <= -90) hoek += 180;
    tekstGecentreerd(page, `${Math.round(ml.lengte)}`, midden, 2.2, f.gewoon, kleur, hoek);
  }

  // --- ruimtelabels
  for (const r of v.ruimtes) {
    const c = naar(zwaartepunt(r.contour));
    const m2 = (oppervlakte(r.contour) / 1e6).toFixed(2).replace(".", ",");
    tekstGecentreerd(page, r.naam, { x: c.x, y: c.y + 5.5 * PT }, 3.2, f.vet, ZWART);
    tekstGecentreerd(page, `${m2} m²`, c, 2.5, f.gewoon, GRIJS);
    const bm = binnenmaten(r);
    if (bm) tekstGecentreerd(page, `${bm.breedte} × ${bm.diepte}`, { x: c.x, y: c.y - 4.5 * PT }, 2.2, f.gewoon, GRIJS);
  }

  tekenKader(page, b, h);
  tekenTitelblok(page, f, p, v, { papier, schaal, past, blad, bladen, ...opties }, b);
}

function tekstGecentreerd(page: PDFPage, s: string, c: { x: number; y: number }, hoogteMm: number, font: PDFFont, kleur: RGB, hoekGraden = 0) {
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

function tekenKader(page: PDFPage, b: number, h: number) {
  page.drawRectangle({
    x: (RAND / 2) * PT, y: (RAND / 2) * PT, width: (b - RAND) * PT, height: (h - RAND) * PT,
    borderColor: ZWART, borderWidth: 0.5 * PT,
  });
}

function tekenTitelblok(
  page: PDFPage,
  f: Fonts,
  p: Project,
  v: Verdieping,
  o: PdfOpties & { datum: string; papier: Papier; schaal: Schaal; past: boolean; blad: number; bladen: number },
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
  tekst(`Plan bestaande toestand — ${v.naam}`, x0 + 3, y0 + hb - 27, 9, f.vet);
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

  // Legende meetbronnen
  label("Betrouwbaarheid maten", xLeg + 3, y0 + hb - 5);
  const legende: Array<[MeetMethode, string]> = [
    ["gescand", "Gescand (± enkele cm)"],
    ["gecorrigeerd", "Gecorrigeerd / ingegeven"],
    ["laser", "Lasermeting (± 2 mm)"],
  ];
  legende.forEach(([m, s], i) => {
    const y = y0 + hb - 12 - i * 6;
    page.drawLine({ start: { x: mm(xLeg + 3), y: mm(y + 1) }, end: { x: mm(xLeg + 11), y: mm(y + 1) }, thickness: mm(0.6), color: KLEUR[m] });
    tekst(s, xLeg + 13, y, 7.5);
  });
  const dragend = v.muren.some((m) => m.dragend === "vermoeden");
  if (dragend) tekst("Dragende muren: niet vastgesteld", xLeg + 3, y0 + 4, 6.5, f.gewoon, GRIJS);

  // Disclaimer
  label("Belangrijk", xDisc + 3, y0 + hb - 5);
  regels(DISCLAIMER, f.gewoon, 7, kolDisc - 6).forEach((r, i) => tekst(r, xDisc + 3, y0 + hb - 10 - i * 3.4, 7));
}

function afkappen(s: string, font: PDFFont, size: number, maxMm: number): string {
  const max = maxMm * PT;
  if (font.widthOfTextAtSize(s, size) <= max) return s;
  while (s.length > 1 && font.widthOfTextAtSize(s + "…", size) > max) s = s.slice(0, -1);
  return s + "…";
}

function regels(s: string, font: PDFFont, size: number, maxMm: number): string[] {
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
