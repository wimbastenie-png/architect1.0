/**
 * Bewerken van een bestaand plan: openingen wijzigen of verplaatsen,
 * een tussenmuur uitbreken (twee ruimtes → één), een ruimte verwijderen,
 * en sparingen (trapgat, vide, schacht) in de vloer.
 * Alle functies geven een nieuwe verdieping terug; bij een fout: Error met
 * een melding die je zo aan de gebruiker kunt tonen.
 */
import { aansluitingen, binnenmaten, muurLengte, oppervlakte, zwaartepunt } from "./geometrie.ts";
import type { Bron, Opening, Project, Punt, Ruimte, Sparing, Verdieping } from "./schema.ts";

// ---------------------------------------------------------------- openingen

export type OpeningWijziging = Partial<Pick<Opening, "soort" | "offset" | "breedte" | "hoogte" | "borstwering">>;

/** Wijzigt een opening (ook verplaatsen: `offset`). Controleert dat ze in de muur past en niet overlapt. */
export function wijzigOpening(v: Verdieping, id: string, w: OpeningWijziging): Verdieping {
  const o = v.openingen.find((x) => x.id === id);
  if (!o) throw new Error(`Opening '${id}' bestaat niet.`);
  const m = v.muren.find((x) => x.id === o.muurId);
  if (!m) throw new Error(`Muur '${o.muurId}' bestaat niet.`);
  const n: Opening = { ...o, ...w, bron: { methode: "manueel", nauwkeurigheidMm: 5 } };
  for (const k of ["offset", "breedte", "hoogte", "borstwering"] as const) n[k] = Math.round(n[k]);
  if (!(n.breedte > 0 && n.hoogte > 0) || n.offset < 0 || n.borstwering < 0) throw new Error("Maten van de opening moeten positief zijn.");
  const a = aansluitingen(m, v.muren);
  const L = muurLengte(m);
  if (n.offset < a.start - 0.5 || n.offset + n.breedte > L - a.eind + 0.5)
    throw new Error("De opening past niet binnen de muur (van hoek tot hoek).");
  if (n.borstwering + n.hoogte > m.hoogte) throw new Error("De opening is hoger dan de muur.");
  const botsing = v.openingen.find(
    (x) => x.id !== id && x.muurId === n.muurId && x.offset < n.offset + n.breedte && n.offset < x.offset + x.breedte,
  );
  if (botsing) throw new Error(`De opening overlapt met een andere ${botsing.soort} in deze muur.`);
  return { ...v, openingen: v.openingen.map((x) => (x.id === id ? n : x)) };
}

export function verwijderOpening(v: Verdieping, id: string): Verdieping {
  if (!v.openingen.some((x) => x.id === id)) throw new Error(`Opening '${id}' bestaat niet.`);
  return { ...v, openingen: v.openingen.filter((x) => x.id !== id) };
}

// ---------------------------------------------------------------- muur uitbreken

/**
 * Breekt een tussenmuur uit: de muur verdwijnt en de twee ruimtes aan
 * weerszijden worden één ruimte. Kan voorlopig enkel als beide ruimtes
 * rechthoekig zijn en samen weer een rechthoek vormen (dezelfde breedte
 * langs de muur).
 *
 * LET OP: of de muur dragend is, kan de app niet vaststellen. Een dragende
 * muur wegnemen vraagt een stabiliteitsstudie (ingenieur) en meestal een
 * omgevingsvergunning. De webapp toont die waarschuwing vóór het uitbreken.
 */
export function breekMuurUit(v: Verdieping, muurId: string): Verdieping {
  const m = v.muren.find((x) => x.id === muurId);
  if (!m) throw new Error(`Muur '${muurId}' bestaat niet.`);
  const buren = v.ruimtes.filter((r) => r.muurIds.includes(muurId));
  if (buren.length !== 2) throw new Error("Alleen een muur tussen twee ruimtes kan uitgebroken worden (geen buitenmuur).");
  const [a, b] = buren as [Ruimte, Ruimte];
  if (!binnenmaten(a) || !binnenmaten(b))
    throw new Error("Uitbreken kan voorlopig enkel tussen twee rechthoekige ruimtes.");
  const alle = [...a.contour, ...b.contour];
  const minX = Math.min(...alle.map((p) => p.x)), maxX = Math.max(...alle.map((p) => p.x));
  const minY = Math.min(...alle.map((p) => p.y)), maxY = Math.max(...alle.map((p) => p.y));
  const samen = (maxX - minX) * (maxY - minY);
  // Vormen ze samen (met de muur ertussen) een rechthoek?
  const overspanning = muurOverlap(a, b, m.dikte);
  if (overspanning === null || Math.abs(samen - (oppervlakte(a.contour) + oppervlakte(b.contour) + overspanning * m.dikte)) > 1)
    throw new Error("Beide ruimtes moeten even breed zijn langs deze muur, zodat er één rechthoekige ruimte overblijft.");

  const groot = oppervlakte(a.contour) >= oppervlakte(b.contour) ? a : b;
  const klein = groot === a ? b : a;
  const nieuw: Ruimte = {
    ...groot,
    naam: `${groot.naam} + ${klein.naam}`,
    contour: [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }],
    plafondhoogte: Math.min(a.plafondhoogte, b.plafondhoogte),
    muurIds: [...new Set([...a.muurIds, ...b.muurIds])].filter((id) => id !== muurId),
    notities: [a.notities, b.notities].filter(Boolean).join("\n") || undefined,
  };
  return {
    ...v,
    muren: v.muren.filter((x) => x.id !== muurId),
    openingen: v.openingen.filter((o) => o.muurId !== muurId),
    ruimtes: v.ruimtes.filter((r) => r !== klein).map((r) => (r === groot ? nieuw : r)),
  };
}

/** Lengte waarover twee rechthoekige ruimtes tegenover elkaar liggen, gescheiden door een muur van `dikte`. */
function muurOverlap(a: Ruimte, b: Ruimte, dikte: number): number | null {
  const box = (r: Ruimte) => ({
    x1: Math.min(...r.contour.map((p) => p.x)), x2: Math.max(...r.contour.map((p) => p.x)),
    y1: Math.min(...r.contour.map((p) => p.y)), y2: Math.max(...r.contour.map((p) => p.y)),
  });
  const A = box(a), B = box(b);
  const naast = (p: number, q: number) => Math.abs(q - p - dikte) <= 1;
  if (naast(A.x2, B.x1) || naast(B.x2, A.x1)) return A.y1 === B.y1 && A.y2 === B.y2 ? A.y2 - A.y1 : null;
  if (naast(A.y2, B.y1) || naast(B.y2, A.y1)) return A.x1 === B.x1 && A.x2 === B.x2 ? A.x2 - A.x1 : null;
  return null;
}

// ---------------------------------------------------------------- ruimte verwijderen

/**
 * Verwijdert een ruimte, met de muren die alleen bij deze ruimte horen en de
 * openingen en sparingen daarin. Gedeelde muren blijven staan (ze worden
 * buitenmuur van de buurruimte).
 */
export function verwijderRuimte(v: Verdieping, ruimteId: string): Verdieping {
  const r = v.ruimtes.find((x) => x.id === ruimteId);
  if (!r) throw new Error(`Ruimte '${ruimteId}' bestaat niet.`);
  if (v.ruimtes.length <= 1) throw new Error("Dit is de laatste ruimte van de verdieping. Verwijder dan de verdieping.");
  const gebruik = new Map<string, number>();
  for (const x of v.ruimtes) for (const id of x.muurIds) gebruik.set(id, (gebruik.get(id) ?? 0) + 1);
  const weg = new Set(r.muurIds.filter((id) => (gebruik.get(id) ?? 0) <= 1));
  return {
    ...v,
    muren: v.muren.filter((m) => !weg.has(m.id)),
    openingen: v.openingen.filter((o) => !weg.has(o.muurId)),
    ruimtes: v.ruimtes.filter((x) => x.id !== ruimteId),
    sparingen: (v.sparingen ?? []).filter((s) => !binnenVeelhoek(zwaartepunt(s.contour), r.contour)),
  };
}

// ---------------------------------------------------------------- sparingen

export interface NieuweSparing {
  ruimteId: string;
  soort: Sparing["soort"];
  /** Afstand van de linkse binnenmuur (kleinste x) van de ruimte, mm. */
  x: number;
  /** Afstand van de onderste binnenmuur (kleinste y) van de ruimte, mm. */
  y: number;
  breedte: number;
  lengte: number;
  methode?: "manueel" | "laser";
}

export function voegSparingToe(v: Verdieping, i: NieuweSparing): Verdieping {
  const r = v.ruimtes.find((x) => x.id === i.ruimteId);
  if (!r) throw new Error(`Ruimte '${i.ruimteId}' bestaat niet.`);
  const B = Math.round(i.breedte), L = Math.round(i.lengte);
  if (!(B > 0 && L > 0) || i.x < 0 || i.y < 0) throw new Error("Maten van de sparing moeten positief zijn.");
  const x0 = Math.min(...r.contour.map((p) => p.x)) + Math.round(i.x);
  const y0 = Math.min(...r.contour.map((p) => p.y)) + Math.round(i.y);
  const contour: Punt[] = [{ x: x0, y: y0 }, { x: x0 + B, y: y0 }, { x: x0 + B, y: y0 + L }, { x: x0, y: y0 + L }];
  const z = zwaartepunt(contour);
  // hoeken 1 mm naar binnen getrokken: een sparing tegen de muur is toegelaten
  const binnen = contour.every((p) => binnenVeelhoek({ x: p.x + Math.sign(z.x - p.x), y: p.y + Math.sign(z.y - p.y) }, r.contour));
  if (!binnen) throw new Error(`De ${i.soort} valt (deels) buiten '${r.naam}'.`);
  for (const s of v.sparingen ?? []) {
    if (contour.some((p) => binnenVeelhoek({ x: p.x + Math.sign(z.x - p.x), y: p.y + Math.sign(z.y - p.y) }, s.contour)) || binnenVeelhoek(zwaartepunt(s.contour), contour))
      throw new Error("Deze sparing overlapt met een bestaande sparing.");
  }
  const ids = new Set((v.sparingen ?? []).map((s) => s.id));
  let k = 1;
  while (ids.has(`s-${k}@${v.id}`)) k++;
  const bron: Bron = { methode: i.methode ?? "manueel", nauwkeurigheidMm: i.methode === "laser" ? 2 : 5 };
  return { ...v, sparingen: [...(v.sparingen ?? []), { id: `s-${k}@${v.id}`, soort: i.soort, contour, bron }] };
}

export function verwijderSparing(v: Verdieping, id: string): Verdieping {
  return { ...v, sparingen: (v.sparingen ?? []).filter((s) => s.id !== id) };
}

/** Sparingen in de vloer van deze ruimte (zwaartepunt binnen de ruimte). */
export function sparingenIn(r: Ruimte, v: Verdieping): Sparing[] {
  return (v.sparingen ?? []).filter((s) => binnenVeelhoek(zwaartepunt(s.contour), r.contour));
}

/** Netto vloeroppervlak in mm²: ruimte min sparingen in haar vloer. */
export function vloerNetto(r: Ruimte, v: Verdieping): number {
  return Math.max(0, oppervlakte(r.contour) - sparingenIn(r, v).reduce((s, x) => s + oppervlakte(x.contour), 0));
}

/**
 * Netto plafondoppervlak in mm²: ruimte min sparingen in de vloer van de
 * verdieping er direct boven (hoogste peil hoger dan dit peil … het eerste daarboven).
 */
export function plafondNetto(r: Ruimte, v: Verdieping, p: Pick<Project, "verdiepingen">): number {
  const boven = [...p.verdiepingen].filter((x) => x.peil > v.peil).sort((a, b) => a.peil - b.peil)[0];
  const aftrek = (boven?.sparingen ?? [])
    .filter((s) => binnenVeelhoek(zwaartepunt(s.contour), r.contour))
    .reduce((s, x) => s + oppervlakte(x.contour), 0);
  return Math.max(0, oppervlakte(r.contour) - aftrek);
}

export function binnenVeelhoek(p: Punt, c: Punt[]): boolean {
  let in_ = false;
  for (let k = 0, j = c.length - 1; k < c.length; j = k++) {
    const a = c[k]!, b = c[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) in_ = !in_;
  }
  return in_;
}
