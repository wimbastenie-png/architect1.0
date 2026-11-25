/**
 * Maatkettingen zoals op een opmetingsplan: per zijde van het gebouw (onder,
 * boven, links, rechts) rijen buiten het hele gebouw, van binnen naar buiten:
 *   rij 0 — openingen: gevelstuk · raam/deur · gevelstuk …
 *   rij 1 — gevel: elk gevelstuk (ook verspringingen en aanbouwen)
 *   rij 2 — totaal: de totale buitenmaat van die zijde
 * Omdat alle maten op lijnen buiten het gebouw geprojecteerd worden, kruisen
 * ze nooit een aanbouw. Een schuine gevel krijgt zijn eigen zijde met rijen
 * evenwijdig aan die gevel.
 */
import { maatlijnen, muurLengte, muurVorm, type Maatlijn } from "./geometrie.ts";
import type { MeetMethode, Muur, Punt, Verdieping } from "./schema.ts";

export interface MaatOpties {
  /** Afstand van het gebouw tot de eerste rij (mm). */
  afstand?: number;
  /** Afstand tussen rijen (mm). */
  tussen?: number;
}

const ZWAKSTE: MeetMethode[] = ["overgenomen", "gescand", "gecorrigeerd", "manueel", "laser"];

interface Stuk { lo: number; hi: number; muur: Muur }

/** Richting langs een zijde: voor haakse zijden altijd +x of +y (zoals vroeger). */
function langs(n: Punt): Punt {
  let u = { x: -n.y, y: n.x };
  if (u.x < -1e-9 || (Math.abs(u.x) <= 1e-9 && u.y < 0)) u = { x: -u.x, y: -u.y };
  return u;
}

export function maatketens(v: Verdieping, opties: MaatOpties = {}): Maatlijn[] {
  const afstand = opties.afstand ?? 600, tussen = opties.tussen ?? 450;
  const basis = maatlijnen(v);
  if (!basis.length) return [];
  const muren = new Map(v.muren.map((m) => [m.id, m]));
  const hoeken = v.muren.flatMap((m) => muurVorm(m, v.muren));
  const dot = (p: Punt, q: Punt) => p.x * q.x + p.y * q.y;

  // Zijden = gevels met dezelfde buitenrichting (afgerond op 0,1°): de vier
  // haakse zijden, plus één zijde per schuine gevelrichting.
  const zijden = new Map<string, { n: Punt; stukken: Stuk[] }>();
  for (const ml of basis) {
    if (!ml.van || !ml.tot) continue;
    const graden = Math.round(((Math.atan2(ml.n.y, ml.n.x) * 180) / Math.PI) * 10) / 10;
    const sleutel = String(graden === -180 ? 180 : graden);
    const z = zijden.get(sleutel) ?? { n: ml.n, stukken: [] };
    const u = langs(z.n);
    const [lo, hi] = [dot(ml.van, u), dot(ml.tot, u)].sort((a, b) => a - b) as [number, number];
    z.stukken.push({ lo, hi, muur: muren.get(ml.muurId)! });
    zijden.set(sleutel, z);
  }

  const uit: Maatlijn[] = [];
  for (const { n, stukken } of zijden.values()) {
    const u = langs(n);
    // de rijen liggen voorbij het verste punt van het gebouw in deze richting
    const rand = Math.max(...hoeken.map((p) => dot(p, n)));
    const lijnOp = (k: number) => rand + afstand + k * tussen;
    const punt = (t: number, pos: number): Punt => ({ x: u.x * t + n.x * pos, y: u.y * t + n.y * pos });
    // gevelvlak bij positie t: het meest naar buiten liggende muurvlak daar
    const gevel = (t: number, kandidaten: Stuk[]): Punt => {
      let best = -Infinity;
      for (const s of kandidaten) {
        if (t < s.lo - 1 || t > s.hi + 1) continue;
        best = Math.max(best, dot(s.muur.start, n) + s.muur.dikte / 2);
      }
      return punt(t, best === -Infinity ? rand : best);
    };
    let rij = 0;
    const leg = (bps: number[], gedekt: Stuk[], soort: number) => {
      const pos = lijnOp(rij);
      const sorted = [...new Set(bps.map((x) => Math.round(x)))].sort((a, b) => a - b);
      let aantal = 0;
      for (let k = 0; k < sorted.length - 1; k++) {
        const a = sorted[k]!, b = sorted[k + 1]!;
        const mid = (a + b) / 2;
        const dek = gedekt.find((s) => mid > s.lo && mid < s.hi);
        if (!dek || b - a < 1) continue;
        uit.push({
          muurId: dek.muur.id, a: punt(a, pos), b: punt(b, pos), n, lengte: b - a,
          methode: dek.muur.bron.methode, rij: soort,
          hulpA: gevel(a, gedekt), hulpB: gevel(b, gedekt),
        });
        aantal++;
      }
      if (aantal) rij++;
      return aantal;
    };

    // rij 0: openingen (alleen gevelstukken met ramen/deuren)
    const metOpening = stukken.filter((s) => v.openingen.some((o) => o.muurId === s.muur.id));
    if (metOpening.length) {
      const bps = metOpening.flatMap((s) => [s.lo, s.hi]);
      for (const s of metOpening) {
        const m = s.muur, L = muurLengte(m);
        const um = { x: (m.eind.x - m.start.x) / L, y: (m.eind.y - m.start.y) / L };
        for (const o of v.openingen.filter((x) => x.muurId === m.id)) {
          for (const d of [o.offset, o.offset + o.breedte]) bps.push(dot({ x: m.start.x + um.x * d, y: m.start.y + um.y * d }, u));
        }
      }
      leg(bps, metOpening, 0);
    }
    // rij 1: gevelstukken
    const aantal = leg(stukken.flatMap((s) => [s.lo, s.hi]), stukken, 1);
    // rij 2: totaal (alleen als de gevel uit meerdere stukken bestaat)
    if (aantal > 1) {
      const lo = Math.min(...stukken.map((s) => s.lo)), hi = Math.max(...stukken.map((s) => s.hi));
      const zwakste = stukken.map((s) => s.muur.bron.methode).reduce((a, b) => (ZWAKSTE.indexOf(a) <= ZWAKSTE.indexOf(b) ? a : b));
      const pos = lijnOp(rij);
      uit.push({
        muurId: "", a: punt(lo, pos), b: punt(hi, pos), n, lengte: hi - lo, methode: zwakste, rij: 2,
        hulpA: gevel(lo, stukken), hulpB: gevel(hi, stukken),
      });
    }
  }
  return uit;
}

/** Geschatte breedte van een maatgetal in dezelfde eenheid als `hoogte`. */
export function tekstBreedte(s: string, hoogte: number): number {
  return s.length * hoogte * 0.62;
}
