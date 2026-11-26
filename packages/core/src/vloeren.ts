/**
 * Vloeren (ruimtecontouren) die hun muren niet meer raken: opsporen en
 * rechtzetten. Zo'n toestand kon ontstaan in vorige versies (muur verschuiven
 * naast een schuine muur) en blijft bewaard in het projectbestand of op het
 * toestel. Rechtzetten gebeurt enkel bij ruimtes die echt stuk zijn: geldige
 * ruimtes blijven ongemoeid.
 */
import { muurLengte, oppervlakte, zwaartepunt } from "./geometrie.ts";
import { zelfkruisend } from "./bewerken.ts";
import type { Muur, Punt, Ruimte, Verdieping } from "./schema.ts";

export interface VloerProbleem {
  ruimteId: string;
  ruimte: string;
  muurId: string;
}

/** Muren korter dan twee keer hun dikte liggen in een hoekzone: niet beoordelen. */
const telt = (m: Muur) => muurLengte(m) >= 2 * m.dikte;

/**
 * Raakt de vloer van r het vlak van muur m? Ja als een rand van de vloer
 * langs het muurvlak loopt (beide hoekpunten op ± dikte/2 van de hartlijn)
 * en die rand overlapt met de muur. Een rand, geen hoekpunt: bij een muur die
 * in stukken gesplitst is (ruimte ertegen gezet), liggen de hoekpunten aan de
 * uiteinden van de oorspronkelijke muur, ver van het middelste stuk.
 */
export function raaktMuur(r: Ruimte, m: Muur, marge = 2): boolean {
  const L = muurLengte(m), u = { x: (m.eind.x - m.start.x) / L, y: (m.eind.y - m.start.y) / L }, n = { x: -u.y, y: u.x };
  const t = (q: Punt) => (q.x - m.start.x) * u.x + (q.y - m.start.y) * u.y;
  // Toegelaten afwijking groeit met de afstand voorbij het muurstuk (± 0,17°): stukken van
  // een gesplitste schuine muur liggen door afronding op hele mm niet exact op één lijn.
  const opVlak = (q: Punt) => {
    const tq = t(q), voorbij = Math.max(0, -tq, tq - L);
    return Math.abs(Math.abs((q.x - m.start.x) * n.x + (q.y - m.start.y) * n.y) - m.dikte / 2) <= marge + voorbij * 0.003;
  };
  return r.contour.some((a, k) => {
    const b = r.contour[(k + 1) % r.contour.length]!;
    if (!opVlak(a) || !opVlak(b)) return false;
    const [lo, hi] = [t(a), t(b)].sort((x, y) => x - y) as [number, number];
    return Math.min(hi, L + m.dikte) - Math.max(lo, -m.dikte) > 1; // overlap met de muur
  });
}

/** Ruimtes waarvan de vloer een van haar muren niet raakt. */
export function controleerVloeren(v: Verdieping): VloerProbleem[] {
  const uit: VloerProbleem[] = [];
  for (const r of v.ruimtes) {
    for (const id of r.muurIds) {
      const m = v.muren.find((x) => x.id === id);
      if (m && telt(m) && !raaktMuur(r, m)) uit.push({ ruimteId: r.id, ruimte: r.naam, muurId: m.id });
    }
  }
  return uit;
}

interface Lijn { p: Punt; d: Punt; muur: Muur }

/**
 * Zet de vloeren recht die hun muren niet raken: elk hoekpunt wordt het
 * snijpunt van de twee dichtstbijzijnde binnenvlakken van de muren van die
 * ruimte (vlakken die minstens 10° verschillen, snijpunt binnen 2,5 m).
 * Het resultaat wordt gecontroleerd (raakt alle muren, kruist zichzelf niet);
 * lukt dat niet, dan blijft de ruimte ongewijzigd en staat ze in `mislukt`.
 */
export function herstelVloeren(v: Verdieping): { verdieping: Verdieping; hersteld: string[]; mislukt: string[] } {
  const stuk = new Set(controleerVloeren(v).map((p) => p.ruimteId));
  const hersteld: string[] = [], mislukt: string[] = [];
  const ruimtes = v.ruimtes.map((r) => {
    if (!stuk.has(r.id)) return r;
    const z = zwaartepunt(r.contour);
    const vlakken: Lijn[] = r.muurIds.flatMap((id) => {
      const m = v.muren.find((x) => x.id === id);
      if (!m) return [];
      const L = muurLengte(m), u = { x: (m.eind.x - m.start.x) / L, y: (m.eind.y - m.start.y) / L }, n = { x: -u.y, y: u.x };
      const kant = (z.x - m.start.x) * n.x + (z.y - m.start.y) * n.y >= 0 ? 1 : -1; // binnenkant = kant van de ruimte
      return [{ p: { x: m.start.x + n.x * kant * (m.dikte / 2), y: m.start.y + n.y * kant * (m.dikte / 2) }, d: u, muur: m }];
    });
    const nabij = (l: Lijn, x: Punt) => {
      const t = (x.x - l.muur.start.x) * l.d.x + (x.y - l.muur.start.y) * l.d.y;
      return t > -l.muur.dikte * 3 && t < muurLengte(l.muur) + l.muur.dikte * 3;
    };
    const contour = r.contour.map((q) => {
      let beste: Punt | null = null, score = 2500;
      for (let i = 0; i < vlakken.length; i++) for (let j = i + 1; j < vlakken.length; j++) {
        const a = vlakken[i]!, b = vlakken[j]!;
        const k = a.d.x * b.d.y - a.d.y * b.d.x;
        if (Math.abs(k) < 0.17) continue; // bijna evenwijdig: geen hoek
        const t = ((b.p.x - a.p.x) * b.d.y - (b.p.y - a.p.y) * b.d.x) / k;
        const x = { x: a.p.x + a.d.x * t, y: a.p.y + a.d.y * t };
        if (!nabij(a, x) || !nabij(b, x)) continue;
        const s = Math.hypot(x.x - q.x, x.y - q.y);
        if (s < score) { score = s; beste = x; }
      }
      return beste ? { x: Math.round(beste.x), y: Math.round(beste.y) } : q;
    }).filter((p, k, c) => { const vorig = c[(k - 1 + c.length) % c.length]!; return c.length < 2 || Math.hypot(p.x - vorig.x, p.y - vorig.y) >= 1; });
    const kandidaat: Ruimte = { ...r, contour };
    const muren = r.muurIds.map((id) => v.muren.find((m) => m.id === id)).filter((m): m is Muur => !!m && telt(m));
    const goed = contour.length >= 3 && !zelfkruisend(contour) && oppervlakte(contour) > 0 && muren.every((m) => raaktMuur(kandidaat, m));
    if (!goed) { mislukt.push(r.naam); return r; }
    hersteld.push(r.naam);
    return kandidaat;
  });
  return { verdieping: hersteld.length ? { ...v, ruimtes } : v, hersteld, mislukt };
}
