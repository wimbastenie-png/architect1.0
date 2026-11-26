/**
 * Werfopvolging en offerte: offertegegevens, btw 6 % of 21 %, vorderingsstaat.
 * De app bereidt voor; de aannemer controleert prijzen, hoeveelheden en
 * voorwaarden. Geen juridisch of fiscaal advies.
 */
import { lastenboek } from "./lastenboek.ts";
import { raming, type Prijzen } from "./prijzen.ts";
import type { Project } from "./schema.ts";

export interface Firma {
  naam: string;
  adres?: string;
  btw?: string;
  iban?: string;
  telefoon?: string;
  email?: string;
  /** Logo als data-URL (PNG of JPEG), op dit toestel bewaard. */
  logo?: string;
}

export interface OfferteInvoer {
  nummer: string;
  datum: string; // ISO
  klant: string;
  klantAdres?: string;
  btwPct: 6 | 21;
  geldigheidDagen: number;
  betaling: string;
  opmerking?: string;
}

/** Voorwaarden voor 6 % btw bij renovatie van een woning (België) — door de klant te bevestigen. Na te kijken bij de boekhouder. */
export const BTW6_VOORWAARDEN =
  "Verlaagd btw-tarief van 6 % (renovatie): de woning wordt na de werken hoofdzakelijk als privéwoning gebruikt, werd minstens 10 jaar vóór de eerste factuur voor het eerst in gebruik genomen, en de werken worden rechtstreeks gefactureerd aan de eindverbruiker. De klant bevestigt dit schriftelijk (attest of vermelding op de factuur). Na te kijken bij uw boekhouder; de app geeft geen fiscaal advies.";

export const STANDAARD_BETALING = "30 % voorschot bij opdracht, saldo volgens vorderingsstaten, betaalbaar binnen 15 dagen na factuurdatum.";

export interface OfferteRegel { code: string; omschrijving: string; groep?: string; eenheid: string; hoeveelheid: number; prijs: number; bedrag: number }

export function offerteRegels(p: Project, prijzen: Prijzen): { regels: OfferteRegel[]; zonderPrijs: string[]; excl: number } {
  const r = raming(lastenboek(p), prijzen, 21);
  const regels = r.regels.filter((x) => x.eenheidsprijs !== undefined).map((x) => ({ code: x.code, omschrijving: x.omschrijving, groep: x.groep, eenheid: x.eenheid, hoeveelheid: x.hoeveelheid, prijs: x.eenheidsprijs!, bedrag: x.bedrag! }));
  return { regels, zonderPrijs: r.zonderPrijs, excl: r.exclBtw };
}

export interface VorderingRegel extends OfferteRegel { vorigProcent: number; procent: number; uitgevoerd: number; dezeStaat: number }

/** Vorderingsstaat nr (index in p.vorderingen): per post het cumulatieve % en het bedrag van deze staat. */
export function vorderingsstaat(p: Project, prijzen: Prijzen, nr: number): { regels: VorderingRegel[]; totaalUitgevoerd: number; vorigTotaal: number; dezeStaat: number } {
  const staat = p.vorderingen.find((x) => x.nr === nr);
  const vorige = p.vorderingen.filter((x) => x.nr < nr).sort((a, b) => b.nr - a.nr)[0];
  const { regels } = offerteRegels(p, prijzen);
  const c2 = (x: number) => Math.round(x * 100) / 100;
  const uit = regels.map((r) => {
    const procent = Math.max(0, Math.min(100, staat?.procent[r.code] ?? 0));
    const vorigProcent = Math.max(0, Math.min(100, vorige?.procent[r.code] ?? 0));
    const uitgevoerd = c2((r.bedrag * procent) / 100);
    return { ...r, procent, vorigProcent, uitgevoerd, dezeStaat: c2(uitgevoerd - (r.bedrag * vorigProcent) / 100) };
  });
  const totaalUitgevoerd = c2(uit.reduce((s, x) => s + x.uitgevoerd, 0));
  const vorigTotaal = c2(uit.reduce((s, x) => s + (x.bedrag * x.vorigProcent) / 100, 0));
  return { regels: uit, totaalUitgevoerd, vorigTotaal, dezeStaat: c2(totaalUitgevoerd - vorigTotaal) };
}

/** Nieuwe (open) vorderingsstaat, vertrekkend van de percentages van de vorige. */
export function nieuweVordering(p: Project, datum = new Date().toISOString().slice(0, 10)): Project {
  const laatste = p.vorderingen[p.vorderingen.length - 1];
  const nr = (laatste?.nr ?? 0) + 1;
  return { ...p, vorderingen: [...p.vorderingen.map((x) => ({ ...x, afgesloten: true })), { nr, datum, procent: { ...(laatste?.procent ?? {}) }, afgesloten: false }] };
}
