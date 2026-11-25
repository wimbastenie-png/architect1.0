/** Planvoorbeeld als SVG — dezelfde tekening die app en webviewer tonen. */
import { vloerNetto } from "./bewerken.ts";
import { maatketens, tekstBreedte } from "./maatvoering.ts";
import { openingLabelPunt, openingLabels } from "./openingen.ts";
import { binnenmaten, m2Tekst, muurRechthoek, muurVorm, oppervlakte, puntLangsMuur, zwaartepunt } from "./geometrie.ts";
import type { MeetMethode, Punt, Verdieping } from "./schema.ts";

const KLEUR: Record<MeetMethode, string> = {
  gescand: "#b45309", // oranje: indicatief
  gecorrigeerd: "#1d4ed8",
  manueel: "#1d4ed8",
  laser: "#15803d", // groen: betrouwbaar
  overgenomen: "#78716c", // grijs: niet gemeten
};

export interface SvgOpties {
  marge?: number;
  /** Id van de geselecteerde muur: wordt gemarkeerd, met A (start) en B (eind). */
  geselecteerd?: string;
  /** Voegt `data-muur` / `data-ruimte` toe zodat de webapp klikken kan opvangen. */
  interactief?: boolean;
  /** Opening die gemarkeerd wordt (bv. tijdens het slepen). */
  opening?: string;
  /** Labels per opening-id (codes over het hele project); standaard per verdieping genummerd. */
  labels?: Map<string, string>;
  /**
   * Vast tekenkader (plan-mm) i.p.v. het automatisch berekende: tijdens het
   * slepen, zodat de tekening niet in- of uitzoomt onder de vinger.
   */
  kader?: { minX: number; maxX: number; minY: number; maxY: number };
  /**
   * Straal van de aanraakzone (plan-mm) rond muren, ramen en hoeken. De
   * webapp rekent die om uit een vaste grootte op het scherm (± 22 px op een
   * gsm), zodat een vinger ook raakt als het plan ver uitgezoomd is.
   */
  raak?: number;
}

export function verdiepingNaarSVG(v: Verdieping, opties: SvgOpties = {}): string {
  const ia = opties.interactief ?? false;
  const marge = opties.marge ?? 400;
  const ketens = maatketens(v);
  const alle = [...v.muren.flatMap((m) => muurVorm(m, v.muren)), ...ketens.flatMap((k) => [k.a, k.b].map((p) => ({ x: p.x + k.n.x * 300, y: p.y + k.n.y * 300 })))];
  const xs = alle.map((p) => p.x), ys = alle.map((p) => p.y);
  const k = opties.kader;
  const minX = k ? k.minX : Math.min(...xs) - marge, maxX = k ? k.maxX : Math.max(...xs) + marge;
  const minY = k ? k.minY : Math.min(...ys) - marge, maxY = k ? k.maxY : Math.max(...ys) + marge;
  // SVG-y loopt naar beneden; plan-y naar boven → spiegelen.
  const t = (p: Punt) => `${(p.x - minX).toFixed(0)},${(maxY - p.y).toFixed(0)}`;
  const w = maxX - minX, h = maxY - minY;
  const el: string[] = [];

  for (const r of v.ruimtes) {
    el.push(`<polygon points="${r.contour.map(t).join(" ")}" fill="#f5f5f4" stroke="none"${ia ? ` data-ruimte="${esc(r.id)}" style="cursor:pointer"` : ""}/>`);
    const c = zwaartepunt(r.contour);
    const [cx, cy] = t(c).split(",");
    const m2 = m2Tekst(vloerNetto(r, v));
    el.push(`<text x="${cx}" y="${Number(cy) - 120}" font-size="220" text-anchor="middle" font-weight="600">${esc(r.naam)}</text>`);
    el.push(`<text x="${cx}" y="${Number(cy) + 200}" font-size="180" text-anchor="middle" fill="#57534e">${m2} m²</text>`);
    const bm = binnenmaten(r);
    if (bm) el.push(`<text x="${cx}" y="${Number(cy) + 440}" font-size="160" text-anchor="middle" fill="#57534e">${bm.breedte} × ${bm.diepte}</text>`);
  }
  // sparingen (trapgat, vide, schacht): kader in streeplijn met kruis
  for (const sp of v.sparingen ?? []) {
    const pts = sp.contour.map(t);
    el.push(`<polygon points="${pts.join(" ")}" fill="#fff" stroke="#57534e" stroke-width="14" stroke-dasharray="80 50" pointer-events="none"/>`);
    if (pts.length === 4) {
      el.push(`<line x1="${pts[0]!.split(",")[0]}" y1="${pts[0]!.split(",")[1]}" x2="${pts[2]!.split(",")[0]}" y2="${pts[2]!.split(",")[1]}" stroke="#a8a29e" stroke-width="8" pointer-events="none"/>`);
      el.push(`<line x1="${pts[1]!.split(",")[0]}" y1="${pts[1]!.split(",")[1]}" x2="${pts[3]!.split(",")[0]}" y2="${pts[3]!.split(",")[1]}" stroke="#a8a29e" stroke-width="8" pointer-events="none"/>`);
    }
    const [sx, sy] = t(zwaartepunt(sp.contour)).split(",");
    el.push(`<text x="${sx}" y="${sy}" font-size="130" text-anchor="middle" dominant-baseline="central" fill="#57534e" paint-order="stroke" stroke="#fff" stroke-width="40" pointer-events="none">${sp.soort}</text>`);
  }
  for (const m of v.muren) {
    const sel = m.id === opties.geselecteerd;
    const stijl = sel ? "cursor:grab" : "cursor:pointer";
    el.push(`<polygon points="${muurVorm(m, v.muren).map(t).join(" ")}" fill="${sel ? "#dc2626" : "#292524"}"${ia ? ` data-muur="${esc(m.id)}" style="${stijl}"` : ""}/>`);
  }
  const muren = new Map(v.muren.map((m) => [m.id, m]));
  for (const o of v.openingen) {
    const m = muren.get(o.muurId);
    if (!m) continue;
    const deel = { ...m, start: puntLangsMuur(m, o.offset), eind: puntLangsMuur(m, o.offset + o.breedte) };
    const actief = o.id === opties.opening;
    const stijl = m.id === opties.geselecteerd ? "cursor:grab" : "cursor:pointer";
    el.push(`<polygon points="${muurRechthoek(deel).map(t).join(" ")}" fill="${actief ? "#fde68a" : "#fff"}" stroke="${actief ? "#b45309" : "#0e7490"}" stroke-width="${actief ? 40 : 20}"${ia ? ` data-muur="${esc(m.id)}" data-opening="${esc(o.id)}" style="${stijl}"` : ""}/>`);
    if (o.soort === "raam") el.push(`<line pointer-events="none" x1="${t(deel.start).split(",")[0]}" y1="${t(deel.start).split(",")[1]}" x2="${t(deel.eind).split(",")[0]}" y2="${t(deel.eind).split(",")[1]}" stroke="#0e7490" stroke-width="20"/>`);
  }
  // aanraaklaag: onzichtbare brede lijnen langs muren en openingen (vaste grootte op het scherm)
  if (ia && opties.raak) {
    const lijn = (a: Punt, b: Punt, breedte: number, attr: string) => {
      const [x1, y1] = t(a).split(","), [x2, y2] = t(b).split(",");
      el.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="transparent" stroke-width="${breedte.toFixed(0)}" pointer-events="stroke" data-raak="1"${attr}/>`);
    };
    for (const m of v.muren) {
      const stijl = m.id === opties.geselecteerd ? "cursor:grab" : "cursor:pointer";
      lijn(m.start, m.eind, Math.max(m.dikte, 2 * opties.raak), ` data-muur="${esc(m.id)}" style="${stijl}"`);
    }
    for (const o of v.openingen) {
      const m = muren.get(o.muurId);
      if (!m) continue;
      const stijl = m.id === opties.geselecteerd ? "cursor:grab" : "cursor:pointer";
      lijn(puntLangsMuur(m, o.offset), puntLangsMuur(m, o.offset + o.breedte), Math.max(m.dikte, 2 * opties.raak), ` data-muur="${esc(m.id)}" data-opening="${esc(o.id)}" style="${stijl}"`);
    }
  }
  // hulplijnen
  for (const ml of ketens) {
    for (const [hp, q] of [[ml.hulpA, ml.a], [ml.hulpB, ml.b]] as const) {
      if (!hp) continue;
      const [x1, y1] = t({ x: hp.x + ml.n.x * 70, y: hp.y + ml.n.y * 70 }).split(",");
      const [x2, y2] = t({ x: q.x + ml.n.x * 60, y: q.y + ml.n.y * 60 }).split(",");
      el.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#a8a29e" stroke-width="6" pointer-events="none"/>`);
    }
  }
  // codes bij ramen en deuren
  const labels = opties.labels ?? openingLabels({ verdiepingen: [v] });
  for (const o of v.openingen) {
    const tekst = labels.get(o.id), plek = openingLabelPunt(v, o, 130);
    if (!tekst || !plek) continue;
    const [lx, ly] = t(plek.punt).split(",");
    el.push(`<text x="${lx}" y="${ly}" font-size="120" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="#0e7490" pointer-events="none" transform="rotate(${(-plek.hoek).toFixed(1)} ${lx} ${ly})">${esc(tekst)}</text>`);
  }

  for (const ml of ketens) {
    const { a, b, n } = ml;
    const kleur = KLEUR[ml.methode];
    const lijn = (p: Punt, q: Punt, dikte = 12) => {
      const [x1, y1] = t(p).split(","), [x2, y2] = t(q).split(",");
      el.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${kleur}" stroke-width="${dikte}"/>`);
    };
    lijn(a, b);
    const u = { x: (b.x - a.x) / ml.lengte, y: (b.y - a.y) / ml.lengte };
    for (const q of [a, b]) {
      lijn({ x: q.x - n.x * 90, y: q.y - n.y * 90 }, { x: q.x + n.x * 90, y: q.y + n.y * 90 });
      lijn({ x: q.x - (u.x + n.x) * 50, y: q.y - (u.y + n.y) * 50 }, { x: q.x + (u.x + n.x) * 50, y: q.y + (u.y + n.y) * 50 }, 24);
    }
    const tekst = `${Math.round(ml.lengte)}`;
    // past het getal niet tussen de streepjes: kleiner, aan de binnenkant
    const klein = tekstBreedte(tekst, 160) > ml.lengte * 0.9;
    const grootte = klein ? 120 : 160;
    const afst = klein ? -110 : 110;
    const tp = { x: (a.x + b.x) / 2 + n.x * afst, y: (a.y + b.y) / 2 + n.y * afst };
    const [mx, my] = t(tp).split(",");
    let hoek = -(Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    if (hoek > 90 || hoek <= -90) hoek += 180;
    const klik = ia && ml.muurId ? ` data-muur="${esc(ml.muurId)}" style="cursor:pointer"` : "";
    el.push(`<text${klik} x="${mx}" y="${my}" font-size="${grootte}" text-anchor="middle" dominant-baseline="central" fill="${kleur}"${ml.rij === 2 ? ' font-weight="600"' : ""} transform="rotate(${hoek.toFixed(1)} ${mx} ${my})">${tekst}</text>`);
  }

  const sel = v.muren.find((m) => m.id === opties.geselecteerd);
  if (sel) {
    for (const [p, letter] of [[sel.start, "A"], [sel.eind, "B"]] as const) {
      const [x, y] = t(p).split(",");
      const r = Math.max(200, (opties.raak ?? 0) * 0.6);
      el.push(`<circle cx="${x}" cy="${y}" r="${r.toFixed(0)}" fill="#fff" stroke="#dc2626" stroke-width="${(r * 0.15).toFixed(0)}" pointer-events="none"/>`);
      el.push(`<text x="${x}" y="${y}" font-size="${(r * 1.1).toFixed(0)}" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="#dc2626" pointer-events="none">${letter}</text>`);
      // in de webapp: hoek A/B versleepbaar (maakt de muur schuin), met ruime aanraakzone
      if (ia) el.push(`<circle cx="${x}" cy="${y}" r="${Math.max(r, opties.raak ?? 0).toFixed(0)}" fill="transparent" pointer-events="all" data-hoek="${p.x},${p.y}" style="cursor:move"/>`);
    }
  }

  // data-min-x / data-max-y: om schermcoördinaten terug te rekenen naar plan-mm (slepen)
  return `<svg xmlns="http://www.w3.org/2000/svg" data-min-x="${minX}" data-max-x="${maxX}" data-min-y="${minY}" data-max-y="${maxY}" viewBox="0 0 ${w} ${h}" font-family="Helvetica, Arial, sans-serif" style="background:#fff">\n${el.join("\n")}\n</svg>\n`;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
