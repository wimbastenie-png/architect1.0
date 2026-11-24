/** Planvoorbeeld als SVG — dezelfde tekening die app en webviewer tonen. */
import { binnenmaten, maatlijnen, muurRechthoek, muurVorm, oppervlakte, puntLangsMuur, zwaartepunt } from "./geometrie.ts";
import type { MeetMethode, Punt, Verdieping } from "./schema.ts";

const KLEUR: Record<MeetMethode, string> = {
  gescand: "#b45309", // oranje: indicatief
  gecorrigeerd: "#1d4ed8",
  manueel: "#1d4ed8",
  laser: "#15803d", // groen: betrouwbaar
};

export interface SvgOpties {
  marge?: number;
  /** Id van de geselecteerde muur: wordt gemarkeerd, met A (start) en B (eind). */
  geselecteerd?: string;
  /** Voegt `data-muur` / `data-ruimte` toe zodat de webapp klikken kan opvangen. */
  interactief?: boolean;
}

export function verdiepingNaarSVG(v: Verdieping, opties: SvgOpties = {}): string {
  const ia = opties.interactief ?? false;
  const marge = opties.marge ?? 1100;
  const alle = v.muren.flatMap((m) => muurVorm(m, v.muren));
  const xs = alle.map((p) => p.x), ys = alle.map((p) => p.y);
  const minX = Math.min(...xs) - marge, maxX = Math.max(...xs) + marge;
  const minY = Math.min(...ys) - marge, maxY = Math.max(...ys) + marge;
  // SVG-y loopt naar beneden; plan-y naar boven → spiegelen.
  const t = (p: Punt) => `${(p.x - minX).toFixed(0)},${(maxY - p.y).toFixed(0)}`;
  const w = maxX - minX, h = maxY - minY;
  const el: string[] = [];

  for (const r of v.ruimtes) {
    el.push(`<polygon points="${r.contour.map(t).join(" ")}" fill="#f5f5f4" stroke="none"${ia ? ` data-ruimte="${esc(r.id)}" style="cursor:pointer"` : ""}/>`);
    const c = zwaartepunt(r.contour);
    const [cx, cy] = t(c).split(",");
    const m2 = (oppervlakte(r.contour) / 1e6).toFixed(2).replace(".", ",");
    el.push(`<text x="${cx}" y="${Number(cy) - 120}" font-size="220" text-anchor="middle" font-weight="600">${esc(r.naam)}</text>`);
    el.push(`<text x="${cx}" y="${Number(cy) + 200}" font-size="180" text-anchor="middle" fill="#57534e">${m2} m²</text>`);
    const bm = binnenmaten(r);
    if (bm) el.push(`<text x="${cx}" y="${Number(cy) + 440}" font-size="160" text-anchor="middle" fill="#57534e">${bm.breedte} × ${bm.diepte}</text>`);
  }
  for (const m of v.muren) {
    const sel = m.id === opties.geselecteerd;
    el.push(`<polygon points="${muurVorm(m, v.muren).map(t).join(" ")}" fill="${sel ? "#dc2626" : "#292524"}"${ia ? ` data-muur="${esc(m.id)}" style="cursor:pointer"` : ""}/>`);
  }
  const muren = new Map(v.muren.map((m) => [m.id, m]));
  for (const o of v.openingen) {
    const m = muren.get(o.muurId);
    if (!m) continue;
    const deel = { ...m, start: puntLangsMuur(m, o.offset), eind: puntLangsMuur(m, o.offset + o.breedte) };
    el.push(`<polygon points="${muurRechthoek(deel).map(t).join(" ")}" fill="#fff" stroke="#0e7490" stroke-width="20"/>`);
    if (o.soort === "raam") el.push(`<line x1="${t(deel.start).split(",")[0]}" y1="${t(deel.start).split(",")[1]}" x2="${t(deel.eind).split(",")[0]}" y2="${t(deel.eind).split(",")[1]}" stroke="#0e7490" stroke-width="20"/>`);
  }
  for (const ml of maatlijnen(v)) {
    const { a, b, n } = ml;
    const kleur = KLEUR[ml.methode];
    const lijn = (p: Punt, q: Punt) => {
      const [x1, y1] = t(p).split(","), [x2, y2] = t(q).split(",");
      el.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${kleur}" stroke-width="12"/>`);
    };
    lijn(a, b);
    for (const q of [a, b]) lijn({ x: q.x - n.x * 100, y: q.y - n.y * 100 }, { x: q.x + n.x * 100, y: q.y + n.y * 100 });
    const tp = { x: (a.x + b.x) / 2 + n.x * 130, y: (a.y + b.y) / 2 + n.y * 130 };
    const [mx, my] = t(tp).split(",");
    let hoek = -(Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    if (hoek > 90 || hoek <= -90) hoek += 180;
    el.push(`<text${ia ? ` data-muur="${esc(ml.muurId)}" style="cursor:pointer"` : ""} x="${mx}" y="${my}" font-size="160" text-anchor="middle" dominant-baseline="central" fill="${kleur}" transform="rotate(${hoek.toFixed(1)} ${mx} ${my})">${Math.round(ml.lengte)}</text>`);
  }

  const sel = v.muren.find((m) => m.id === opties.geselecteerd);
  if (sel) {
    for (const [p, letter] of [[sel.start, "A"], [sel.eind, "B"]] as const) {
      const [x, y] = t(p).split(",");
      el.push(`<circle cx="${x}" cy="${y}" r="200" fill="#fff" stroke="#dc2626" stroke-width="30" pointer-events="none"/>`);
      el.push(`<text x="${x}" y="${y}" font-size="220" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="#dc2626" pointer-events="none">${letter}</text>`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" font-family="Helvetica, Arial, sans-serif" style="background:#fff">\n${el.join("\n")}\n</svg>\n`;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
