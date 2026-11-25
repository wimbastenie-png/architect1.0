/**
 * Meerdere verdiepingen: toevoegen (kopie van de indeling van een andere
 * verdieping, of een nieuwe rechthoek), hernoemen en verwijderen.
 *
 * Een kopie neemt muren en ruimtes over, geen ramen en deuren (die verschillen
 * per verdieping). Alle overgenomen maten krijgen meetbron "overgenomen" tot
 * ze nagemeten worden. Id's krijgen het achtervoegsel "@<verdieping-id>",
 * zodat ze in het hele project uniek blijven.
 */
import { rechthoekigProject } from "./sjablonen.ts";
import type { Bron, Project, Verdieping } from "./schema.ts";

export type NieuweVerdieping =
  | { modus: "kopie"; naam: string; vanId?: string; peil?: number; vloerdikte?: number }
  | {
      modus: "rechthoek"; naam: string; peil?: number; vloerdikte?: number;
      binnenBreedte: number; binnenDiepte: number; plafondhoogte: number; muurdikte: number;
      methode?: "manueel" | "laser";
    };

const STANDAARD_VLOERDIKTE = 300; // mm, vloerplaat + afwerking (aanname)

/** Peil voor een verdieping boven `onder`: vloerpeil + hoogste plafond + vloerdikte. */
export function volgendPeil(onder: Verdieping, vloerdikte = STANDAARD_VLOERDIKTE): number {
  const hoogte = Math.max(0, ...onder.ruimtes.map((r) => r.plafondhoogte), ...onder.muren.map((m) => m.hoogte));
  return onder.peil + hoogte + vloerdikte;
}

export function voegVerdiepingToe(p: Project, i: NieuweVerdieping): { project: Project; verdiepingId: string } {
  const bestaand = new Set(p.verdiepingen.map((v) => v.id));
  let k = p.verdiepingen.length;
  while (bestaand.has(`v${k}`)) k++;
  const vid = `v${k}`;
  const bovenste = [...p.verdiepingen].sort((a, b) => b.peil - a.peil)[0]!;
  const naam = i.naam.trim() || `Verdieping ${k}`;
  const hernoem = (id: string) => `${id.split("@")[0]}@${vid}`;

  let nieuw: Verdieping;
  if (i.modus === "kopie") {
    const van = p.verdiepingen.find((v) => v.id === (i.vanId ?? bovenste.id));
    if (!van) throw new Error(`Verdieping '${i.vanId}' bestaat niet.`);
    const bron: Bron = { methode: "overgenomen" };
    nieuw = {
      id: vid,
      naam,
      peil: Math.round(i.peil ?? volgendPeil(van, i.vloerdikte)),
      muren: van.muren.map((m) => ({ ...m, id: hernoem(m.id), bron })),
      openingen: [],
      ruimtes: van.ruimtes.map((r) => ({ ...r, id: hernoem(r.id), muurIds: r.muurIds.map(hernoem), bron })),
      sparingen: [], // een trapgat ligt per verdieping anders; niet overnemen
    };
  } else {
    const basis = rechthoekigProject({
      naam: "x", ruimteNaam: "Ruimte 1", binnenBreedte: i.binnenBreedte, binnenDiepte: i.binnenDiepte,
      plafondhoogte: i.plafondhoogte, muurdikte: i.muurdikte, methode: i.methode,
    }).verdiepingen[0]!;
    nieuw = {
      ...basis,
      id: vid,
      naam,
      peil: Math.round(i.peil ?? volgendPeil(bovenste, i.vloerdikte)),
      muren: basis.muren.map((m) => ({ ...m, id: hernoem(m.id) })),
      ruimtes: basis.ruimtes.map((r) => ({ ...r, id: hernoem(r.id), muurIds: r.muurIds.map(hernoem) })),
    };
  }
  const verdiepingen = [...p.verdiepingen, nieuw].sort((a, b) => a.peil - b.peil);
  return { project: { ...p, verdiepingen }, verdiepingId: vid };
}

export function hernoemVerdieping(p: Project, id: string, naam: string): Project {
  if (!naam.trim()) throw new Error("Een verdieping heeft een naam nodig.");
  return { ...p, verdiepingen: p.verdiepingen.map((v) => (v.id === id ? { ...v, naam: naam.trim() } : v)) };
}

export function zetPeil(p: Project, id: string, peil: number): Project {
  const verdiepingen = p.verdiepingen.map((v) => (v.id === id ? { ...v, peil: Math.round(peil) } : v)).sort((a, b) => a.peil - b.peil);
  return { ...p, verdiepingen };
}

export function verwijderVerdieping(p: Project, id: string): Project {
  if (p.verdiepingen.length <= 1) throw new Error("Een project heeft minstens één verdieping.");
  if (!p.verdiepingen.some((v) => v.id === id)) throw new Error(`Verdieping '${id}' bestaat niet.`);
  return { ...p, verdiepingen: p.verdiepingen.filter((v) => v.id !== id) };
}

/** Peil als tekst zoals op plannen: +2,90 m / ±0,00 m / −0,45 m. */
export function peilTekst(peil: number): string {
  const m = (Math.abs(peil) / 1000).toFixed(2).replace(".", ",");
  return peil === 0 ? `±${m} m` : `${peil > 0 ? "+" : "−"}${m} m`;
}
