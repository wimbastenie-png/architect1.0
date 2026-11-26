/**
 * PDF ontwerp: per verdieping het plan "verbouwing" (bestaand zwart, afbreken
 * geel, nieuw rood) en het plan "nieuwe toestand", daarna de doorsneden en de
 * vier gevelaanzichten op schaal, en de waarschuwingen.
 */
import { PDFDocument, StandardFonts, rgb, type PDFPage, type RGB } from "pdf-lib";
import { muurRechthoek, muurVorm, puntLangsMuur } from "./geometrie.ts";
import {
  aanzicht, doorsnede, muurToestand, ONTWERP_DISCLAIMER, ontwerpWaarschuwingen, openingToestand, TOESTAND_KLEUR, verdiepingInToestand, ZIJDEN, type Tekening,
} from "./ontwerp.ts";
import { lijstBladen } from "./pdf-lijst.ts";
import { kiesBlad, pdfTekst, PAPIER, PT, RAND, tekenBlad, tekenPaginaKader, tekenTitelblok, TITELBLOK_H, type Fonts, type Papier, type PdfOpties, type Schaal } from "./pdf.ts";
import type { Project, Punt } from "./schema.ts";

const hex = (k: string): RGB => { const h = k.length === 4 ? `#${k[1]}${k[1]}${k[2]}${k[2]}${k[3]}${k[3]}` : k; return rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255); };
const LEGENDE: Array<[RGB, string]> = [
  [hex(TOESTAND_KLEUR.bestaand), "Bestaand, blijft"],
  [hex("#eab308"), "Af te breken (geel)"],
  [hex(TOESTAND_KLEUR.nieuw), "Nieuw (rood)"],
];

export async function ontwerpNaarPDF(p: Project, opties: PdfOpties = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${p.naam} — ontwerp (schets)`);
  doc.setCreator("architect1.0");
  const f: Fonts = { gewoon: await doc.embedFont(StandardFonts.Helvetica), vet: await doc.embedFont(StandardFonts.HelveticaBold) };
  const datum = opties.datum ?? new Date().toISOString().slice(0, 10);
  const o = { ...opties, datum, disclaimer: ONTWERP_DISCLAIMER };
  const titelblokken: Array<(blad: number, bladen: number) => void> = [];

  for (const v of p.verdiepingen) {
    titelblokken.push(tekenBlad(doc, f, p, v, o, {
      titel: `Plan verbouwing — ${v.naam}`,
      legende: LEGENDE,
      teken: ({ page, naar, H }) => {
        const veelhoek = (pts: Punt[], vul: RGB, rand?: RGB, dik = 0) => {
          const d = pts.map((q, i) => { const r = naar(q); return `${i ? "L" : "M"}${r.x.toFixed(2)},${(H - r.y).toFixed(2)}`; }).join(" ") + " Z";
          page.drawSvgPath(d, { x: 0, y: H, color: vul, borderColor: rand, borderWidth: rand ? dik : 0, borderDashArray: rand ? [3, 2] : undefined });
        };
        for (const m of v.muren) {
          const t = muurToestand(m);
          if (t !== "bestaand") veelhoek(muurVorm(m, v.muren), hex(TOESTAND_KLEUR[t]), t === "afbreken" ? hex("#292524") : undefined, 0.6);
        }
        for (const op of v.openingen) {
          const t = openingToestand(op);
          const m = v.muren.find((x) => x.id === op.muurId);
          if (!m || t === "bestaand") continue;
          const deel = { ...m, start: puntLangsMuur(m, op.offset), eind: puntLangsMuur(m, op.offset + op.breedte) };
          veelhoek(muurRechthoek(deel), hex(t === "nieuw" ? TOESTAND_KLEUR.afbreken : TOESTAND_KLEUR.nieuw), hex("#0e7490"), 0.5);
        }
      },
    }));
    titelblokken.push(tekenBlad(doc, f, p, verdiepingInToestand(v, "nieuw"), o, { titel: `Plan nieuwe toestand — ${v.naam}` }));
  }
  const papier = kiesBlad(p.verdiepingen[0]!, opties).papier;
  for (const d of p.doorsneden) titelblokken.push(tekeningBlad(doc, f, p, doorsnede(p, d.a, d.b, { naam: d.naam, toestand: "verbouwing" }), o, papier, `Doorsnede ${d.naam} (verbouwing)`));
  for (const z of ZIJDEN) titelblokken.push(tekeningBlad(doc, f, p, aanzicht(p, z.zijde, { toestand: "nieuw" }), o, papier, `${z.naam} — nieuwe toestand`));

  const w = ontwerpWaarschuwingen(p);
  const lijst = lijstBladen(doc, f, p, o, papier, "Ontwerp — aandachtspunten", ["Status", "Schetsontwerp, geen vergunningsplan."]);
  lijst.kop("Aandachtspunten ontwerp");
  if (!w.length) lijst.alinea("Geen afbraak van (mogelijk) dragende muren en geen nieuwe openingen in (mogelijk) dragende muren.");
  for (const x of w) lijst.alinea(`${x.verdieping ? `${x.verdieping}: ` : ""}${x.tekst}`, { kleur: rgb(0.6, 0.2, 0.05) });
  lijst.kop("Wat dit plan niet is");
  lijst.alinea(ONTWERP_DISCLAIMER);
  lijst.alinea("Doorsneden tonen alleen wat de snijlijn raakt; gevels tonen buitenmuren en openingen, zonder dak, goot of buitenaanleg.");
  titelblokken.push(...lijst.titelblokken);
  titelblokken.forEach((t, i) => t(i + 1, titelblokken.length));
  return doc.save();
}

/** Eén tekening (doorsnede, aanzicht) op schaal 1:50, 1:100 of 1:200, met titelblok. */
function tekeningBlad(doc: PDFDocument, f: Fonts, p: Project, t: Tekening, o: PdfOpties & { datum: string }, papier: Papier, titel: string) {
  const { b, h } = PAPIER[papier];
  const vakB = b - 2 * RAND, vakH = h - 2 * RAND - TITELBLOK_H;
  const w = t.maxX - t.minX, hh = t.maxY - t.minY;
  const schaal = ([50, 100, 200] as Schaal[]).find((s) => w / s <= vakB && hh / s <= vakH) ?? 200;
  const past = w / schaal <= vakB && hh / schaal <= vakH;
  const page = doc.addPage([b * PT, h * PT]);
  const ox = RAND + (vakB - w / schaal) / 2, oy = RAND + TITELBLOK_H + (vakH - hh / schaal) / 2;
  const naar = (q: Punt) => ({ x: (ox + (q.x - t.minX) / schaal) * PT, y: (oy + (q.y - t.minY) / schaal) * PT });
  tekenElementen(page, f, t, naar, schaal);
  tekenPaginaKader(page, b, h);
  return (blad: number, bladen: number) => tekenTitelblok(page, f, p, titel, { ...o, papier, schaal, past, blad, bladen, legende: LEGENDE }, b);
}

function tekenElementen(page: PDFPage, f: Fonts, t: Tekening, naar: (q: Punt) => { x: number; y: number }, schaal: number) {
  const dik = (mm: number) => Math.max(0.25, (mm / schaal) * PT * 1.2);
  for (const e of t.elementen) {
    if (e.t === "rect") {
      const a = naar({ x: e.x, y: e.y }), c = naar({ x: e.x + e.b, y: e.y + e.h });
      page.drawRectangle({ x: a.x, y: a.y, width: c.x - a.x, height: c.y - a.y, color: e.vul ? hex(e.vul) : undefined, borderColor: e.lijn ? hex(e.lijn) : undefined, borderWidth: e.lijn ? dik(e.dikte ?? 10) : 0, borderDashArray: e.streep ? [3, 2] : undefined });
    } else if (e.t === "lijn") {
      page.drawLine({ start: naar(e.a), end: naar(e.b), color: hex(e.lijn), thickness: dik(e.dikte), dashArray: e.streep ? [3, 2] : undefined });
    } else {
      const size = Math.max(5, Math.min(12, ((e.grootte / schaal) * PT) / 0.72));
      const font = e.vet ? f.vet : f.gewoon;
      const tekst = pdfTekst(e.s);
      const w = font.widthOfTextAtSize(tekst, size);
      const q = naar(e.p);
      const x = e.anker === "middle" ? q.x - w / 2 : e.anker === "end" ? q.x - w : q.x;
      page.drawText(tekst, { x, y: q.y, size, font, color: hex(e.kleur ?? "#1c1917") });
    }
  }
}
