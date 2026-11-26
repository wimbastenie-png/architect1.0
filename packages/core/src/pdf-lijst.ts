/**
 * Algemene lijstbladen voor PDF-exports (installaties, rekennota's …):
 * twee kolommen, koppen, tabellen en alinea's, met titelblok.
 */
import { rgb, type PDFDocument, type PDFFont, type PDFPage } from "pdf-lib";
import { afkappen, pdfTekst, PAPIER, PT, RAND, regels, tekenPaginaKader, tekenTitelblok, TITELBLOK_H, type Fonts, type Papier, type PdfOpties } from "./pdf.ts";
import type { Project } from "./schema.ts";

export interface Kolom { kop: string; breedte: number; rechts?: boolean }

const ZWART = rgb(0.16, 0.15, 0.14);
export const GRIJS_LIJST = rgb(0.34, 0.33, 0.31);

export interface LijstApi {
  kop: (s: string) => void;
  tabel: (kolommen: Kolom[], rijen: string[][]) => void;
  alinea: (s: string, o?: { vet?: boolean; kleur?: ReturnType<typeof rgb>; grootte?: number }) => void;
  /** Breedte van een kolom (mm). */
  kolB: number;
  /** Nieuw blad forceren (bv. voor een tekening). Geeft het blad en het tekenvak (mm) terug. */
  heelBlad: (titel: string) => { page: PDFPage; x: number; y: number; b: number; h: number };
  titelblokken: Array<(blad: number, bladen: number) => void>;
}

export function lijstBladen(doc: PDFDocument, f: Fonts, p: Project, opties: PdfOpties & { datum: string }, papier: Papier, titel: string, middenTekst?: [string, string]): LijstApi {
  const { b, h } = PAPIER[papier];
  const mm = (q: number) => q * PT;
  const titelblokken: Array<(blad: number, bladen: number) => void> = [];
  const tussen = 8;
  const kolB = (b - 2 * RAND - tussen) / 2;
  const boven = h - RAND - 4, onder = RAND + TITELBLOK_H + 2;
  const RIJ = 4.2;
  let page: PDFPage | null = null, kol = 0, y = 0;

  const nieuwBlad = (t = titel) => {
    const pg = doc.addPage([b * PT, h * PT]);
    page = pg;
    tekenPaginaKader(pg, b, h);
    titelblokken.push((blad, bladen) => tekenTitelblok(pg, f, p, t, { papier, past: true, blad, bladen, ...opties, middenTekst }, b));
    kol = 0;
    y = boven;
    return pg;
  };
  const x0 = () => RAND + kol * (kolB + tussen);
  const plaats = (nodig: number) => {
    if (!page) { nieuwBlad(); return; }
    if (y - nodig >= onder) return;
    if (kol === 0) { kol = 1; y = boven; return; }
    nieuwBlad();
  };
  const tekst = (s: string, x: number, yy: number, size: number, font: PDFFont, kleur = ZWART) =>
    page!.drawText(pdfTekst(s), { x: mm(x), y: mm(yy), size, font, color: kleur });
  const kop = (s: string) => {
    plaats(14);
    y -= 6;
    tekst(afkappen(s, f.vet, 10, kolB), x0(), y, 10, f.vet);
    y -= 2;
  };
  const rij = (kolommen: Kolom[], waarden: string[], vet = false) => {
    plaats(RIJ + 1);
    y -= RIJ;
    let x = x0();
    kolommen.forEach((k, i) => {
      const font = vet ? f.vet : f.gewoon;
      const w = afkappen(waarden[i] ?? "", font, 7.5, k.breedte - 1.5);
      const tx = k.rechts ? x + k.breedte - 1.5 - font.widthOfTextAtSize(pdfTekst(w), 7.5) / PT : x;
      tekst(w, tx, y + 1.2, 7.5, font);
      x += k.breedte;
    });
    if (vet) page!.drawLine({ start: { x: mm(x0()), y: mm(y) }, end: { x: mm(x0() + kolB), y: mm(y) }, thickness: mm(0.25), color: ZWART });
  };
  const tabel = (kolommen: Kolom[], rijen: string[][]) => {
    rij(kolommen, kolommen.map((k) => k.kop), true);
    for (const r of rijen) {
      if (y - (RIJ + 1) < onder) { plaats(RIJ * 2 + 2); rij(kolommen, kolommen.map((k) => k.kop), true); }
      rij(kolommen, r);
    }
  };
  const alinea = (s: string, o: { vet?: boolean; kleur?: ReturnType<typeof rgb>; grootte?: number } = {}) => {
    const g = o.grootte ?? 7.5, stap = g * 0.48;
    const lijnen = s.split("\n").flatMap((l) => regels(l, o.vet ? f.vet : f.gewoon, g, kolB));
    plaats(Math.min(lijnen.length, 3) * stap + 2);
    y -= 1.5;
    for (const l of lijnen) {
      plaats(stap);
      y -= stap;
      tekst(l, x0(), y, g, o.vet ? f.vet : f.gewoon, o.kleur ?? ZWART);
    }
  };
  const heelBlad = (t: string) => {
    const pg = nieuwBlad(t);
    y = onder; kol = 1; // volgend gebruik begint op een nieuw blad
    return { page: pg, x: RAND, y: onder, b: b - 2 * RAND, h: boven - onder };
  };
  return { kop, tabel, alinea, kolB, heelBlad, titelblokken };
}
