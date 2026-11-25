/** Rekenfuncties op het projectformaat. Invoer en uitvoer in mm tenzij anders vermeld. */
import type { Muur, Opening, Punt, Ruimte, Verdieping } from "./schema.ts";

/**
 * Twee muren liggen "in elkaars verlengde" als hun richtingen minder dan
 * ± 0,57° verschillen (|sin| < 0,01). Niet exact 0: splitsingspunten van een
 * schuine muur worden op hele mm afgerond, waardoor de stukken een heel klein
 * hoekje maken. Bij haakse plannen verandert dit niets.
 */
export const RECHTDOOR = 0.01;

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

/**
 * mm² → m², afgerond op 0,01 m². Rekent in hele mm² (geen kommagetallen),
 * zodat plan, meetstaat en lastenboek altijd hetzelfde getal tonen.
 */
export function m2(mm2: number): number {
  return Math.round(mm2 / 1e4) / 100;
}

/** m² als tekst met decimale komma: "26,33". */
export function m2Tekst(mm2: number): string {
  return m2(mm2).toFixed(2).replace(".", ",");
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
    if (Math.abs(kruis) > RECHTDOOR) verschoven.set(sleutel(ander), { punt: ander, dikte: w.dikte });
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

// ---------------------------------------------------------------- hoeken en vlakken

interface Lijn { p: Punt; d: Punt }

const richting = (m: Muur): Punt => {
  const L = muurLengte(m);
  return { x: (m.eind.x - m.start.x) / L, y: (m.eind.y - m.start.y) / L };
};
const zelfdePt = (a: Punt, b: Punt) => a.x === b.x && a.y === b.y;
/** Het andere uiteinde van w, gezien vanuit punt p. */
const anderEind = (w: Muur, p: Punt) => (zelfdePt(w.start, p) ? w.eind : w.start);

/** Muurvlak van w aan de kant van punt `naar` (lijn evenwijdig aan de hartlijn op dikte/2). */
function vlak(w: Muur, naar: Punt): Lijn {
  const u = richting(w), n = { x: -u.y, y: u.x };
  const s = (naar.x - w.start.x) * n.x + (naar.y - w.start.y) * n.y >= 0 ? 1 : -1;
  return { p: { x: w.start.x + n.x * s * (w.dikte / 2), y: w.start.y + n.y * s * (w.dikte / 2) }, d: u };
}

/** Snijpunt van twee lijnen; null als ze (bijna) evenwijdig zijn (< ±10°): dan geen verstek. */
function snijpunt(a: Lijn, b: Lijn): Punt | null {
  const kruis = a.d.x * b.d.y - a.d.y * b.d.x;
  if (Math.abs(kruis) < 0.17) return null;
  const t = ((b.p.x - a.p.x) * b.d.y - (b.p.y - a.p.y) * b.d.x) / kruis;
  return { x: a.p.x + a.d.x * t, y: a.p.y + a.d.y * t };
}

/** Muren die in punt p aan m raken: niet in het verlengde (haaks of schuin) en in het verlengde. */
function aanPunt(m: Muur, p: Punt, alle: Muur[]): { schuin: Muur[]; rechtdoor: Muur[] } {
  const u = richting(m);
  const schuin: Muur[] = [], rechtdoor: Muur[] = [];
  for (const w of alle) {
    if (w.id === m.id || !(zelfdePt(w.start, p) || zelfdePt(w.eind, p))) continue;
    const d = richting(w);
    (Math.abs(u.x * d.y - u.y * d.x) > RECHTDOOR ? schuin : rechtdoor).push(w);
  }
  return { schuin, rechtdoor };
}

/**
 * Hoe ver (mm, langs de muur, positief = voorbij het hartlijnpunt p naar
 * buiten) het vlak `kant` van m eindigt tegen de aansluitende muren in p.
 * - één aansluitende muur (hoek): verstek, het snijpunt van de vlakken
 *   (binnenvlak met binnenvlak, buitenvlak met buitenvlak)
 * - een doorlopende muur (T): het vlak stopt tegen het vlak van die muur
 * Bij haakse muren geeft dit ±dikte/2, zoals vroeger.
 */
function vlakEinde(m: Muur, p: Punt, kant: Lijn, binnenKant: boolean | null, alle: Muur[]): number | null {
  const { schuin } = aanPunt(m, p, alle);
  if (!schuin.length) return null;
  const uit = zelfdePt(p, m.eind) ? richting(m) : { x: -richting(m).x, y: -richting(m).y };
  const mAnder = anderEind(m, p);
  const kandidaten: number[] = [];
  for (const w of schuin) {
    // T of binnenkant van een hoek: vlak van w naar m toe; buitenkant van een hoek: vlak van w weg van m
    const naarM = schuin.length > 1 || binnenKant !== false;
    const wVlak = naarM ? vlak(w, mAnder) : vlak(w, { x: 2 * p.x - mAnder.x, y: 2 * p.y - mAnder.y });
    const q = snijpunt(kant, wVlak);
    if (q) kandidaten.push((q.x - p.x) * uit.x + (q.y - p.y) * uit.y);
  }
  if (!kandidaten.length) return null;
  return schuin.length > 1 ? Math.max(...kandidaten) : kandidaten[0]!;
}

/**
 * Afstand van het hartlijnpunt tot de binnenhoek, aan elk uiteinde (mm).
 * Daarmee rekenen we tussen hartlijnlengte en binnenmaat:
 * binnenmaat = hartlijn − aansluiting.start − aansluiting.eind.
 * Haaks: de halve dikte van de aansluitende muur. Schuin: via het snijpunt
 * van de binnenvlakken.
 */
export function aansluitingen(m: Muur, alle: Muur[]): { start: number; eind: number } {
  const bij = (p: Punt) => {
    const { schuin } = aanPunt(m, p, alle);
    if (!schuin.length) return 0;
    if (schuin.length === 1) {
      // binnenvlak van m = kant waar de aansluitende muur heen gaat
      const binnen = vlak(m, anderEind(schuin[0]!, p));
      const e = vlakEinde(m, p, binnen, true, alle);
      if (e !== null) return -e;
    } else {
      // T: tot het vlak van de doorlopende muur, langs de hartlijn gemeten
      const as: Lijn = { p: m.start, d: richting(m) };
      const e = vlakEinde(m, p, as, true, alle);
      if (e !== null) return -e;
    }
    return Math.max(...schuin.map((w) => w.dikte / 2));
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
 * Muurvorm voor tekenen: de vier hoekpunten van de muur.
 * - hoek met één andere muur: verstek (snijpunt van de vlakken), ook schuin
 * - T-aansluiting op een doorlopende muur: tegen het vlak van die muur
 * - gevel die recht doorloopt (stuk in het verlengde): recht afgeknipt op de as
 * - vrij uiteinde: recht afgeknipt
 * Zo zijn hoeken dicht (geen kerf) en overlappen muren niet.
 */
export function muurVorm(m: Muur, alle: Muur[]): [Punt, Punt, Punt, Punt] {
  const u = richting(m), n = { x: -u.y, y: u.x }, h = m.dikte / 2;
  const links: Lijn = { p: { x: m.start.x + n.x * h, y: m.start.y + n.y * h }, d: u };
  const rechts: Lijn = { p: { x: m.start.x - n.x * h, y: m.start.y - n.y * h }, d: u };
  const einde = (p: Punt, kant: Lijn, teken: 1 | -1): Punt => {
    const { schuin, rechtdoor } = aanPunt(m, p, alle);
    const uit = zelfdePt(p, m.eind) ? u : { x: -u.x, y: -u.y };
    let e = 0;
    if (schuin.length && !rechtdoor.length) {
      const binnenKant = schuin.length === 1 ? (() => {
        const o = anderEind(schuin[0]!, p);
        return Math.sign((o.x - p.x) * n.x + (o.y - p.y) * n.y) === teken;
      })() : null;
      e = vlakEinde(m, p, kant, binnenKant, alle) ?? Math.max(...schuin.map((w) => w.dikte / 2));
    }
    return { x: p.x + n.x * teken * h + uit.x * e, y: p.y + n.y * teken * h + uit.y * e };
  };
  return [einde(m.start, links, 1), einde(m.eind, links, 1), einde(m.eind, rechts, -1), einde(m.start, rechts, -1)];
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
  /** Begin- en eindpunt van de gemeten maat op de muur zelf (hartlijn, verlengd). */
  van?: Punt;
  tot?: Punt;
  /** Rij in de maatketting: 0 = openingen, 1 = gevel, 2 = totaal. */
  rij?: number;
  /** Punten op het gevelvlak waar de hulplijnen naar a en b vertrekken. */
  hulpA?: Punt;
  hulpB?: Punt;
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
      // naar buiten = weg van de eigen ruimte; zonder ruimte: weg van het planmidden
      const eigen = v.ruimtes.find((r) => r.muurIds.includes(m.id));
      const ref = eigen ? zwaartepunt(eigen.contour) : midden;
      if ((mid.x - ref.x) * n.x + (mid.y - ref.y) * n.y < 0) n = { x: -n.x, y: -n.y };
      const aans = aansluitingen(m, v.muren);
      // De gevel loopt recht door als een collineaire BUITENmuur aansluit
      // (een tussenmuur in het verlengde telt niet: daar springt de gevel).
      const loopDoor = (p: Punt) =>
        v.muren.some((w) => {
          if (w.id === m.id || (telling.get(w.id) ?? 0) >= 2) return false;
          const raakt = (w.start.x === p.x && w.start.y === p.y) || (w.eind.x === p.x && w.eind.y === p.y);
          if (!raakt) return false;
          const wl = muurLengte(w);
          return Math.abs((u.x * (w.eind.y - w.start.y)) / wl - (u.y * (w.eind.x - w.start.x)) / wl) < RECHTDOOR;
        });
      // Uiteinde van de gevelmaat, op het buitenvlak van de muur:
      // - een aansluitende muur steekt naar buiten (aanbouw, doorlopende muur):
      //   stop tegen het vlak van die muur (haaks: −dikte/2)
      // - alleen muren naar binnen (gewone buitenhoek): tot de buitenhoek
      //   (haaks: +dikte/2; schuin: het verstekpunt)
      const buitenvlak = { p: { x: m.start.x + n.x * (m.dikte / 2), y: m.start.y + n.y * (m.dikte / 2) }, d: u };
      const uiteinde = (p: Punt): number => {
        const { schuin } = aanPunt(m, p, v.muren);
        if (!schuin.length) return 0;
        const naarBuiten = schuin.filter((w) => {
          const ander = anderEind(w, p);
          return (ander.x - p.x) * n.x + (ander.y - p.y) * n.y > 1e-6;
        });
        if (naarBuiten.length) {
          const e = vlakEinde(m, p, buitenvlak, true, naarBuiten.length === 1 ? [m, naarBuiten[0]!] : [m, ...naarBuiten]);
          return e ?? -Math.max(...naarBuiten.map((w) => w.dikte)) / 2;
        }
        const e = vlakEinde(m, p, buitenvlak, false, [m, ...schuin]);
        return e ?? Math.max(...schuin.map((w) => w.dikte)) / 2;
      };
      const es = loopDoor(m.start) ? 0 : uiteinde(m.start);
      const ee = loopDoor(m.eind) ? 0 : uiteinde(m.eind);
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
        van: s0,
        tot: e0,
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

/** Zwaartepunt van een veelhoek (voor labels en richting). */
export function zwaartepunt(c: Punt[]): Punt {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < c.length; i++) {
    const p = c[i]!, q = c[(i + 1) % c.length]!;
    const k = p.x * q.y - q.x * p.y;
    a += k; cx += (p.x + q.x) * k; cy += (p.y + q.y) * k;
  }
  if (a === 0) return c[0]!;
  return { x: cx / (3 * a), y: cy / (3 * a) };
}
