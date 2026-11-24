/** Rekenfuncties op het projectformaat. Invoer en uitvoer in mm tenzij anders vermeld. */
import type { Muur, Opening, Punt, Ruimte, Verdieping } from "./schema.ts";

export function afstand(a: Punt, b: Punt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function muurLengte(m: Muur): number {
  return afstand(m.start, m.eind);
}

/** Oppervlakte van een veelhoek (shoelace), in mm². Altijd positief. */
export function oppervlakte(contour: Punt[]): number {
  let s = 0;
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i]!;
    const b = contour[(i + 1) % contour.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

export function omtrek(contour: Punt[]): number {
  let s = 0;
  for (let i = 0; i < contour.length; i++) s += afstand(contour[i]!, contour[(i + 1) % contour.length]!);
  return s;
}

export function openingOppervlakte(o: Opening): number {
  return o.breedte * o.hoogte;
}

/** Bruto en netto (min openingen) zichtvlak van één zijde van een muur, mm². */
export function muurVlak(m: Muur, openingen: Opening[]): { bruto: number; netto: number } {
  const bruto = muurLengte(m) * m.hoogte;
  const af = openingen.filter((o) => o.muurId === m.id).reduce((s, o) => s + openingOppervlakte(o), 0);
  return { bruto, netto: bruto - af };
}

/**
 * Wandoppervlak van een ruimte: omtrek × plafondhoogte, min de openingen
 * in de muren die de ruimte begrenzen. Dit is de maat die een aannemer
 * gebruikt voor pleisterwerk en schilderwerk.
 */
export function ruimteWandVlak(r: Ruimte, v: Verdieping): { bruto: number; netto: number } {
  const bruto = omtrek(r.contour) * r.plafondhoogte;
  const ids = new Set(r.muurIds);
  const af = v.openingen
    .filter((o) => ids.has(o.muurId))
    .reduce((s, o) => s + o.breedte * Math.min(o.hoogte, Math.max(0, r.plafondhoogte - o.borstwering)), 0);
  return { bruto, netto: Math.max(0, bruto - af) };
}

/** De vier hoekpunten van een muur als rechthoek (voor tekenen/export). */
export function muurRechthoek(m: Muur): [Punt, Punt, Punt, Punt] {
  const L = muurLengte(m);
  const nx = (-(m.eind.y - m.start.y) / L) * (m.dikte / 2);
  const ny = ((m.eind.x - m.start.x) / L) * (m.dikte / 2);
  const p = (q: Punt, s: number): Punt => ({ x: q.x + s * nx, y: q.y + s * ny });
  return [p(m.start, 1), p(m.eind, 1), p(m.eind, -1), p(m.start, -1)];
}

/** Punt langs de hartlijn van een muur, op afstand `d` vanaf de start. */
export function puntLangsMuur(m: Muur, d: number): Punt {
  const L = muurLengte(m);
  return {
    x: m.start.x + ((m.eind.x - m.start.x) * d) / L,
    y: m.start.y + ((m.eind.y - m.start.y) * d) / L,
  };
}

const sleutel = (p: Punt) => `${p.x},${p.y}`;

/**
 * Past de lengte van een muur aan (bv. na een lasermeting). Het `vast` uiteinde
 * blijft staan; het andere schuift langs de muurrichting.
 *
 * Gedrag zoals "muur verschuiven" in CAD: haakse (niet-collineaire) muren die
 * aan het verschoven punt vastzitten, schuiven in hun geheel mee; muren die
 * daar weer aan vastzitten, rekken mee. Zo blijft een rechthoekig plan
 * rechthoekig en gesloten. Ruimtecontouren vlak bij een verschoven hoekpunt
 * schuiven mee. Geeft een nieuwe verdieping terug (onveranderlijk).
 */
export function zetMuurLengte(
  v: Verdieping,
  muurId: string,
  nieuweLengte: number,
  vast: "start" | "eind" = "start",
  methode: "gecorrigeerd" | "laser" | "manueel" = "gecorrigeerd",
): Verdieping {
  const m = v.muren.find((x) => x.id === muurId);
  if (!m) throw new Error(`muur '${muurId}' bestaat niet`);
  if (!(nieuweLengte > 0)) throw new Error("lengte moet positief zijn");
  const L = muurLengte(m);
  const [anker, oud] = vast === "start" ? [m.start, m.eind] : [m.eind, m.start];
  const nieuw: Punt = {
    x: Math.round(anker.x + ((oud.x - anker.x) * nieuweLengte) / L),
    y: Math.round(anker.y + ((oud.y - anker.y) * nieuweLengte) / L),
  };
  const dx = nieuw.x - oud.x;
  const dy = nieuw.y - oud.y;

  // Welke punten verschuiven mee? Het verschoven uiteinde + het andere
  // uiteinde van elke haakse muur die daar aansluit.
  const dir = { x: oud.x - anker.x, y: oud.y - anker.y };
  const verschoven = new Map<string, { punt: Punt; dikte: number }>([[sleutel(oud), { punt: oud, dikte: m.dikte }]]);
  for (const w of v.muren) {
    if (w.id === muurId) continue;
    const ander = sleutel(w.start) === sleutel(oud) ? w.eind : sleutel(w.eind) === sleutel(oud) ? w.start : null;
    if (!ander) continue;
    const kruis = dir.x * (ander.y - oud.y) - dir.y * (ander.x - oud.x);
    if (Math.abs(kruis) > 1e-6) verschoven.set(sleutel(ander), { punt: ander, dikte: w.dikte });
  }
  // Zoekstraal per verschoven punt = dikste muur die er aansluit (een
  // binnenhoek ligt op hoogstens ~0,71 × die dikte van het hartlijnpunt).
  for (const [k, s] of verschoven)
    for (const w of v.muren) if (sleutel(w.start) === k || sleutel(w.eind) === k) s.dikte = Math.max(s.dikte, w.dikte);
  const schuif = (q: Punt): Punt => (verschoven.has(sleutel(q)) ? { x: q.x + dx, y: q.y + dy } : q);
  const bijVerschoven = (q: Punt) => [...verschoven.values()].some((s) => afstand(q, s.punt) <= s.dikte);

  return {
    ...v,
    muren: v.muren.map((x) => {
      const n = { ...x, start: schuif(x.start), eind: schuif(x.eind) };
      return x.id === muurId
        ? { ...n, bron: { ...x.bron, methode, nauwkeurigheidMm: methode === "laser" ? 2 : methode === "manueel" ? 5 : x.bron.nauwkeurigheidMm } }
        : n;
    }),
    ruimtes: v.ruimtes.map((r) => ({
      ...r,
      contour: r.contour.map((q) => (bijVerschoven(q) ? { x: q.x + dx, y: q.y + dy } : q)),
    })),
  };
}

/**
 * Halve dikte van de dikste haakse muur die aan elk uiteinde aansluit.
 * Daarmee rekenen we tussen hartlijnlengte en binnenmaat:
 * binnenmaat = hartlijn − aansluiting.start − aansluiting.eind.
 */
export function aansluitingen(m: Muur, alle: Muur[]): { start: number; eind: number } {
  const L = muurLengte(m);
  const ux = (m.eind.x - m.start.x) / L, uy = (m.eind.y - m.start.y) / L;
  const bij = (p: Punt) => {
    let d = 0;
    for (const w of alle) {
      if (w.id === m.id) continue;
      const raakt = (w.start.x === p.x && w.start.y === p.y) || (w.eind.x === p.x && w.eind.y === p.y);
      if (!raakt) continue;
      const wl = muurLengte(w);
      const kruis = Math.abs((ux * (w.eind.y - w.start.y)) / wl - (uy * (w.eind.x - w.start.x)) / wl);
      if (kruis > 1e-6) d = Math.max(d, w.dikte / 2);
    }
    return d;
  };
  return { start: bij(m.start), eind: bij(m.eind) };
}

/** Binnenmaat langs een muur: de maat die je met rolmeter of laser binnen meet. */
export function binnenLengte(m: Muur, alle: Muur[]): number {
  const a = aansluitingen(m, alle);
  return muurLengte(m) - a.start - a.eind;
}

/** Zet de binnenmaat langs een muur (rekent om naar hartlijnlengte). */
export function zetBinnenLengte(
  v: Verdieping,
  muurId: string,
  binnenmaat: number,
  vast: "start" | "eind" = "start",
  methode: "gecorrigeerd" | "laser" | "manueel" = "manueel",
): Verdieping {
  const m = v.muren.find((x) => x.id === muurId);
  if (!m) throw new Error(`muur '${muurId}' bestaat niet`);
  const a = aansluitingen(m, v.muren);
  return zetMuurLengte(v, muurId, binnenmaat + a.start + a.eind, vast, methode);
}

/**
 * Muurvorm voor tekenen: rechthoek rond de hartlijn, aan elk uiteinde
 * verlengd met de halve dikte van de dikste haakse muur die daar aansluit,
 * zodat hoeken dicht zijn (geen "kerf" in de tekening).
 */
export function muurVorm(m: Muur, alle: Muur[]): [Punt, Punt, Punt, Punt] {
  const L = muurLengte(m);
  const ux = (m.eind.x - m.start.x) / L, uy = (m.eind.y - m.start.y) / L;
  const { start: a, eind: b } = aansluitingen(m, alle);
  return muurRechthoek({
    ...m,
    start: { x: m.start.x - ux * a, y: m.start.y - uy * a },
    eind: { x: m.eind.x + ux * b, y: m.eind.y + uy * b },
  });
}

/** Zwaartepunt van alle muurhartlijnen: om te bepalen wat "buiten" is. */
export function planMidden(v: Verdieping): Punt {
  const pts = v.muren.flatMap((m) => [m.start, m.eind]);
  return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
}

export interface Maatlijn {
  muurId: string;
  a: Punt;
  b: Punt;
  /** Eenheidsnormaal naar de buitenkant. */
  n: Punt;
  lengte: number;
  methode: Muur["bron"]["methode"];
}

/**
 * Maatlijnen voor de buitenmaten: één per muur die niet aan twee ruimtes
 * grenst, aan de kant weg van het midden van het plan.
 *
 * De maat loopt tot de buitenkant van de haakse muur aan elk uiteinde. Loopt
 * de gevel daar recht door (een tussenmuur sluit aan), dan stopt de maat op
 * de hartlijn van die tussenmuur: zo tellen de deelmaten op tot de totale
 * buitenmaat (bv. 6150 + 3750 = 9900).
 */
export function maatlijnen(v: Verdieping, afstandMm = 450): Maatlijn[] {
  const midden = planMidden(v);
  const telling = new Map<string, number>();
  for (const r of v.ruimtes) for (const id of r.muurIds) telling.set(id, (telling.get(id) ?? 0) + 1);
  return v.muren
    .filter((m) => (telling.get(m.id) ?? 0) < 2)
    .map((m) => {
      const L = muurLengte(m);
      const u = { x: (m.eind.x - m.start.x) / L, y: (m.eind.y - m.start.y) / L };
      let n = { x: -u.y, y: u.x };
      const mid = { x: (m.start.x + m.eind.x) / 2, y: (m.start.y + m.eind.y) / 2 };
      if ((mid.x - midden.x) * n.x + (mid.y - midden.y) * n.y < 0) n = { x: -n.x, y: -n.y };
      const aans = aansluitingen(m, v.muren);
      const loopDoor = (p: Punt) =>
        v.muren.some((w) => {
          if (w.id === m.id) return false;
          const raakt = (w.start.x === p.x && w.start.y === p.y) || (w.eind.x === p.x && w.eind.y === p.y);
          if (!raakt) return false;
          const wl = muurLengte(w);
          return Math.abs((u.x * (w.eind.y - w.start.y)) / wl - (u.y * (w.eind.x - w.start.x)) / wl) < 1e-6;
        });
      const es = loopDoor(m.start) ? 0 : aans.start;
      const ee = loopDoor(m.eind) ? 0 : aans.eind;
      const s0 = { x: m.start.x - u.x * es, y: m.start.y - u.y * es };
      const e0 = { x: m.eind.x + u.x * ee, y: m.eind.y + u.y * ee };
      const off = m.dikte / 2 + afstandMm;
      return {
        muurId: m.id,
        a: { x: s0.x + n.x * off, y: s0.y + n.y * off },
        b: { x: e0.x + n.x * off, y: e0.y + n.y * off },
        n,
        lengte: L + es + ee,
        methode: m.bron.methode,
      };
    });
}

/** Binnenmaten "breedte × diepte" als de ruimte een assenparallelle rechthoek is. */
export function binnenmaten(r: Ruimte): { breedte: number; diepte: number } | null {
  if (r.contour.length !== 4) return null;
  const xs = new Set(r.contour.map((p) => p.x)), ys = new Set(r.contour.map((p) => p.y));
  if (xs.size !== 2 || ys.size !== 2) return null;
  const [x1, x2] = [...xs].sort((a, b) => a - b), [y1, y2] = [...ys].sort((a, b) => a - b);
  return { breedte: x2! - x1!, diepte: y2! - y1! };
}
