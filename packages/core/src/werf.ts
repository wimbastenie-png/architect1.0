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
  const regels = [...offerteRegels(p, prijzen).regels, ...meerwerkRegels(p)];
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

// ---------------------------------------------------------------------------
// meer- en minwerken

export type Meerwerk = Project["meerwerken"][number];
export type DagboekDag = Project["dagboek"][number];
const c2 = (x: number) => Math.round(x * 100) / 100;

/** Bedrag excl. btw: positief voor meerwerk, negatief voor minwerk. */
export const meerwerkBedrag = (m: Pick<Meerwerk, "soort" | "hoeveelheid" | "prijs">) => c2((m.soort === "min" ? -1 : 1) * m.hoeveelheid * m.prijs);
export const meerwerkCode = (m: Pick<Meerwerk, "nr">) => `MW${m.nr}`;

/** Meer- en minwerken met akkoord van de klant, als posten voor de vorderingsstaat. */
export function meerwerkRegels(p: Project): OfferteRegel[] {
  return p.meerwerken.filter((m) => m.status === "akkoord").map((m) => ({
    code: meerwerkCode(m), omschrijving: `${m.soort === "min" ? "Minwerk" : "Meerwerk"}: ${m.omschrijving}`, groep: "Meer- en minwerken",
    eenheid: m.eenheid, hoeveelheid: m.hoeveelheid, prijs: m.soort === "min" ? -m.prijs : m.prijs, bedrag: meerwerkBedrag(m),
  }));
}

export function meerwerkTotalen(p: Project) {
  const som = (f: (m: Meerwerk) => boolean) => c2(p.meerwerken.filter(f).reduce((s, m) => s + meerwerkBedrag(m), 0));
  return {
    meer: som((m) => m.status === "akkoord" && m.soort === "meer"),
    min: som((m) => m.status === "akkoord" && m.soort === "min"),
    saldo: som((m) => m.status === "akkoord"),
    voorgesteld: som((m) => m.status === "voorgesteld"),
    open: p.meerwerken.filter((m) => m.status === "voorgesteld").length,
  };
}

export function nieuwMeerwerk(p: Project, m: Pick<Meerwerk, "omschrijving" | "soort" | "eenheid" | "hoeveelheid" | "prijs">, datum = new Date().toISOString().slice(0, 10)): { project: Project; id: string } {
  if (!m.omschrijving.trim()) throw new Error("Geef een omschrijving.");
  const nr = Math.max(0, ...p.meerwerken.map((x) => x.nr)) + 1;
  const id = `mw-${nr}-${Math.random().toString(36).slice(2, 6)}`;
  return { project: { ...p, meerwerken: [...p.meerwerken, { id, nr, datum, status: "voorgesteld", ...m, omschrijving: m.omschrijving.trim() }] }, id };
}

/** Status zetten. Akkoord vraagt een naam; een akkoord of weigering ongedaan maken kan alleen zolang de post niet in een afgesloten vorderingsstaat zit. */
export function zetMeerwerkStatus(p: Project, id: string, status: Meerwerk["status"], o: { door?: string; datum?: string; reden?: string } = {}): Project {
  const m = p.meerwerken.find((x) => x.id === id);
  if (!m) throw new Error("Meer- of minwerk niet gevonden.");
  if (status === "akkoord" && !o.door?.trim()) throw new Error("Wie gaf akkoord? Geef de naam van de klant.");
  const code = meerwerkCode(m);
  if (m.status === "akkoord" && status !== "akkoord" && p.vorderingen.some((v) => v.afgesloten && (v.procent[code] ?? 0) > 0))
    throw new Error("Deze post zit al in een afgesloten vorderingsstaat. Maak een minwerk om te corrigeren.");
  const n: Meerwerk = { ...m, status, akkoordDoor: status === "akkoord" ? o.door!.trim() : undefined, akkoordDatum: status === "akkoord" ? (o.datum ?? new Date().toISOString().slice(0, 10)) : undefined, reden: status === "geweigerd" ? o.reden : undefined };
  return { ...p, meerwerken: p.meerwerken.map((x) => (x.id === id ? n : x)) };
}

// ---------------------------------------------------------------------------
// werfdagboek

export const WEER: Record<NonNullable<DagboekDag["weer"]>, string> = { zon: "zon", bewolkt: "bewolkt", regen: "regen", wind: "veel wind", vorst: "vorst", sneeuw: "sneeuw" };

/** De dag op deze datum, of een nieuwe lege dag (nog niet in het project). */
export function dagVan(p: Project, datum: string): DagboekDag {
  return p.dagboek.find((d) => d.datum === datum) ?? { id: `dag-${datum}`, datum, werk: "", fotoIds: [] };
}

/** Een dag bewaren (nieuw of bijwerken), gesorteerd op datum. */
export function bewaarDag(p: Project, d: DagboekDag): Project {
  const rest = p.dagboek.filter((x) => x.id !== d.id && x.datum !== d.datum);
  return { ...p, dagboek: [...rest, d].sort((a, b) => a.datum.localeCompare(b.datum)) };
}

export function dagboekTotalen(p: Project, van?: string, tot?: string) {
  const dagen = p.dagboek.filter((d) => (!van || d.datum >= van) && (!tot || d.datum <= tot));
  return { dagen: dagen.length, werkdagen: dagen.filter((d) => !d.verlet).length, verlet: dagen.filter((d) => d.verlet).length, uren: c2(dagen.reduce((s, d) => s + (d.uren ?? 0), 0)) };
}
