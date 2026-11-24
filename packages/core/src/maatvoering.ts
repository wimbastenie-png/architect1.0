/**
 * Maatkettingen zoals op een opmetingsplan: per zijde van het gebouw (onder,
 * boven, links, rechts) rijen buiten het hele gebouw, van binnen naar buiten:
 *   rij 0 — openingen: gevelstuk · raam/deur · gevelstuk …
 *   rij 1 — gevel: elk gevelstuk (ook verspringingen en aanbouwen)
 *   rij 2 — totaal: de totale buitenmaat van die zijde
 * Omdat alle maten op lijnen buiten het gebouw geprojecteerd worden, kruisen
 * ze nooit een aanbouw. Schuine muren houden hun eigen maatlijn.
 */
import { maatlijnen, muurLengte, muurVorm, type Maatlijn } from "./geometrie.ts";
import type { MeetMethode, Muur, Punt, Verdieping } from "./schema.ts";

export interface MaatOpties {
  /** Afstand van het gebouw tot de eerste rij (mm). */
  afstand?: number;
  /** Afstand tussen rijen (mm). */
  tussen?: number;
}

type Zijde = "onder" | "boven" | "links" | "rechts";
const NORMAAL: Record<Zijde, Punt> = { onder: { x: 0, y: -1 }, boven: { x: 0, y: 1 }, links: { x: -1, y: 0 }, rechts: { x: 1, y: 0 } };
const ZWAKSTE: MeetMethode[] = ["overgenomen", "gescand", "gecorrigeerd", "manueel", "laser"];

interface Stuk { lo: number; hi: number; muur: Muur }

export function maatketens(v: Verdieping, opties: MaatOpties = {}): Maatlijn[] {
  const afstand = opties.afstand ?? 600, tussen = opties.tussen ?? 450;
  const basis = maatlijnen(v);
  if (!basis.length) return [];
  const muren = new Map(v.muren.map((m) => [m.id, m]));
  const hoeken = v.muren.flatMap((m) => muurVorm(m, v.muren));
  const omh = {
    minX: Math.min(...hoeken.map((p) => p.x)), maxX: Math.max(...hoeken.map((p) => p.x)),
    minY: Math.min(...hoeken.map((p) => p.y)), maxY: Math.max(...hoeken.map((p) => p.y)),
  };

  const uit: Maatlijn[] = [];
  const perZijde = new Map<Zijde, Stuk[]>();
  for (const ml of basis) {
    const z = zijdeVan(ml.n);
    const m = muren.get(ml.muurId)!;
    if (!z || !ml.van || !ml.tot) {
      uit.push({ ...ml, rij: 1 }); // schuine muur: eigen maatlijn
      continue;
    }
    const as = z === "onder" || z === "boven" ? "x" : "y";
    const [lo, hi] = [ml.van[as], ml.tot[as]].sort((a, b) => a - b) as [number, number];
    perZijde.set(z, [...(perZijde.get(z) ?? []), { lo, hi, muur: m }]);
  }

  for (const [z, stukken] of perZijde) {
    const n = NORMAAL[z];
    const horizontaal = z === "onder" || z === "boven";
    const rand = z === "onder" ? omh.minY : z === "boven" ? omh.maxY : z === "links" ? omh.minX : omh.maxX;
    const lijnOp = (k: number) => rand + (z === "onder" || z === "links" ? -1 : 1) * (afstand + k * tussen);
    const punt = (t: number, pos: number): Punt => (horizontaal ? { x: t, y: pos } : { x: pos, y: t });
    const teken = z === "onder" || z === "links" ? -1 : 1;
    // gevelvlak bij positie t langs de zijde: het meest naar buiten liggende muurvlak daar
    const gevel = (t: number, kandidaten: Stuk[]): Punt => {
      let best = -Infinity;
      for (const s of kandidaten) {
        if (t < s.lo - 1 || t > s.hi + 1) continue;
        const as = horizontaal ? s.muur.start.y : s.muur.start.x;
        best = Math.max(best, teken * (as + teken * (s.muur.dikte / 2)));
      }
      return punt(t, best === -Infinity ? rand : teken * best);
    };
    let rij = 0;
    const leg = (bps: number[], gedekt: Stuk[], soort: number, methode?: MeetMethode) => {
      const pos = lijnOp(rij);
      const sorted = [...new Set(bps.map((x) => Math.round(x)))].sort((a, b) => a - b);
      let n0 = 0;
      for (let k = 0; k < sorted.length - 1; k++) {
        const a = sorted[k]!, b = sorted[k + 1]!;
        const mid = (a + b) / 2;
        const dek = gedekt.find((s) => mid > s.lo && mid < s.hi);
        if (!dek || b - a < 1) continue;
        uit.push({
          muurId: dek.muur.id, a: punt(a, pos), b: punt(b, pos), n, lengte: b - a,
          methode: methode ?? dek.muur.bron.methode, rij: soort,
          hulpA: gevel(a, gedekt), hulpB: gevel(b, gedekt),
        });
        n0++;
      }
      if (n0) rij++;
      return n0;
    };

    // rij 0: openingen (alleen gevelstukken met ramen/deuren)
    const metOpening = stukken.filter((s) => v.openingen.some((o) => o.muurId === s.muur.id));
    if (metOpening.length) {
      const bps = metOpening.flatMap((s) => [s.lo, s.hi]);
      for (const s of metOpening) {
        const m = s.muur, L = muurLengte(m);
        const u = { x: (m.eind.x - m.start.x) / L, y: (m.eind.y - m.start.y) / L };
        for (const o of v.openingen.filter((x) => x.muurId === m.id)) {
          for (const d of [o.offset, o.offset + o.breedte]) bps.push(horizontaal ? m.start.x + u.x * d : m.start.y + u.y * d);
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

function zijdeVan(n: Punt): Zijde | null {
  if (Math.abs(n.x) < 1e-9) return n.y > 0 ? "boven" : "onder";
  if (Math.abs(n.y) < 1e-9) return n.x > 0 ? "rechts" : "links";
  return null;
}

/** Geschatte breedte van een maatgetal in dezelfde eenheid als `hoogte`. */
export function tekstBreedte(s: string, hoogte: number): number {
  return s.length * hoogte * 0.62;
}
