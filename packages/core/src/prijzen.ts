/**
 * Eenheidsprijzen per lastenboekpost en een raming (excl./incl. btw).
 * De prijzen horen bij de aannemer, niet bij het project: de webapp
 * bewaart ze op het toestel en gebruikt ze voor elk project.
 */
import type { Lastenboek, PostDefinitie } from "./lastenboek.ts";

/** Eenheidsprijs in euro per postcode ("01" … "10", "A01", "R01-100", "E-1A2B" …), excl. btw. */
export type Prijzen = Partial<Record<string, number>>;

export interface RamingRegel extends PostDefinitie {
  hoeveelheid: number;
  eenheidsprijs?: number;
  bedrag?: number;
}

export interface Raming {
  regels: RamingRegel[];
  exclBtw: number;
  btwPct: number;
  btw: number;
  inclBtw: number;
  /** Posten zonder prijs (tellen niet mee in het totaal). */
  zonderPrijs: string[];
}

const c2 = (x: number) => Math.round(x * 100) / 100;

export function raming(lb: Lastenboek, prijzen: Prijzen, btwPct = 21): Raming {
  const regels: RamingRegel[] = lb.totalen.map((t) => {
    const prijs = prijzen[t.code];
    if (prijs === undefined || !Number.isFinite(prijs) || prijs < 0) return { ...t };
    return { ...t, eenheidsprijs: prijs, bedrag: c2(t.hoeveelheid * prijs) };
  });
  const exclBtw = c2(regels.reduce((s, r) => s + (r.bedrag ?? 0), 0));
  const btw = c2((exclBtw * btwPct) / 100);
  return {
    regels, exclBtw, btwPct, btw, inclBtw: c2(exclBtw + btw),
    zonderPrijs: regels.filter((r) => r.eenheidsprijs === undefined).map((r) => r.code),
  };
}

/** Bedrag in Belgische notatie: € 1.234,56 */
export function euro(x: number): string {
  const [geheel, dec] = Math.abs(x).toFixed(2).split(".") as [string, string];
  return `${x < 0 ? "−" : ""}€ ${geheel.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`;
}

/** Leest prijzen uit onbetrouwbare invoer (bv. opslag in de browser of een bestand). */
export function leesPrijzen(data: unknown): Prijzen {
  const uit: Prijzen = {};
  if (!data || typeof data !== "object") return uit;
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (/^[A-Z0-9][A-Za-z0-9-]{0,24}$/.test(k) && typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1e6) uit[k] = v;
  }
  return uit;
}
