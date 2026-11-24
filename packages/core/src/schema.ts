/**
 * Projectformaat v0.1 — het gedeelde bestandsformaat voor gsm, pc en backend.
 *
 * Afspraken:
 * - Alle lengtes in hele millimeters (geen afrondingsfouten, zoals in CAD).
 * - Plan-coördinaten: x naar rechts, y naar boven, gezien van bovenaf.
 * - Muren zijn hartlijnen (start → eind) met een dikte.
 * - Elke gemeten waarde draagt een `bron`: zo weet een professional
 *   welke maten gescand, gecorrigeerd of met de laser gemeten zijn.
 */
import { z } from "zod";

export const SCHEMA_VERSIE = "0.1" as const;

const mm = z.number().int();
const mmPositief = mm.positive();
const id = z.string().min(1);

export const Punt = z.object({ x: mm, y: mm });
export type Punt = z.infer<typeof Punt>;

export const MeetMethode = z.enum([
  "gescand", // automatisch uit RoomPlan/ARCore
  "gecorrigeerd", // door gebruiker aangepast
  "laser", // Bluetooth-laserafstandsmeter
  "manueel", // ingetypt (rolmeter, bestaand plan)
]);
export type MeetMethode = z.infer<typeof MeetMethode>;

export const Bron = z.object({
  methode: MeetMethode,
  /** Geschatte onzekerheid (±mm). */
  nauwkeurigheidMm: z.number().nonnegative().optional(),
  toestel: z.string().optional(),
  tijdstip: z.string().datetime().optional(),
});
export type Bron = z.infer<typeof Bron>;

/**
 * Dragend of niet: een camera kan dit niet zien. "vermoeden" komt uit
 * heuristieken, "bevestigd" alleen door een professional of sloopwerk.
 */
export const Dragend = z.enum(["onbekend", "vermoeden", "bevestigd", "niet-dragend"]);
export type Dragend = z.infer<typeof Dragend>;

export const Muur = z.object({
  id,
  start: Punt,
  eind: Punt,
  dikte: mmPositief,
  hoogte: mmPositief,
  dragend: Dragend.default("onbekend"),
  bron: Bron,
});
export type Muur = z.infer<typeof Muur>;

export const Opening = z.object({
  id,
  muurId: id,
  soort: z.enum(["deur", "raam", "doorgang"]),
  /** Afstand langs de muur, van muur.start tot de rand van de opening. */
  offset: mm.nonnegative(),
  breedte: mmPositief,
  hoogte: mmPositief,
  /** Borstwering: hoogte onderkant opening boven de vloer. */
  borstwering: mm.nonnegative().default(0),
  bron: Bron,
});
export type Opening = z.infer<typeof Opening>;

export const Ruimte = z.object({
  id,
  naam: z.string(),
  /** Binnencontour (afgewerkte binnenmaten), tegen de klok in. */
  contour: z.array(Punt).min(3),
  plafondhoogte: mmPositief,
  /** Muren die deze ruimte begrenzen (voor wandoppervlak in de meetstaat). */
  muurIds: z.array(id).default([]),
  bron: Bron,
});
export type Ruimte = z.infer<typeof Ruimte>;

export const Verdieping = z.object({
  id,
  naam: z.string(),
  /** Peil van de vloer t.o.v. referentiepeil 0, in mm. */
  peil: mm.default(0),
  muren: z.array(Muur).default([]),
  openingen: z.array(Opening).default([]),
  ruimtes: z.array(Ruimte).default([]),
});
export type Verdieping = z.infer<typeof Verdieping>;

export const Project = z.object({
  schemaVersie: z.literal(SCHEMA_VERSIE),
  id,
  naam: z.string(),
  adres: z
    .object({
      straat: z.string().optional(),
      postcode: z.string().optional(),
      gemeente: z.string().optional(),
      /** Bepaalt welke regels later gelden (Vlaanderen/Wallonië/Brussel). */
      gewest: z.enum(["vlaanderen", "wallonie", "brussel"]).optional(),
    })
    .optional(),
  bouwjaar: z.number().int().optional(),
  aangemaakt: z.string().datetime(),
  gewijzigd: z.string().datetime(),
  verdiepingen: z.array(Verdieping).min(1),
});
export type Project = z.infer<typeof Project>;
/** Invoer vóór defaults (bv. ruw JSON-bestand). */
export type ProjectInvoer = z.input<typeof Project>;

export interface Validatiefout {
  pad: string;
  melding: string;
}

/**
 * Leest en controleert een project: structuur (zod) én samenhang
 * (verwijzingen, openingen die binnen hun muur passen).
 */
export function leesProject(
  data: unknown,
): { ok: true; project: Project } | { ok: false; fouten: Validatiefout[] } {
  const r = Project.safeParse(data);
  if (!r.success) {
    return {
      ok: false,
      fouten: r.error.issues.map((i) => ({ pad: i.path.join("."), melding: i.message })),
    };
  }
  const fouten = controleerSamenhang(r.data);
  return fouten.length ? { ok: false, fouten } : { ok: true, project: r.data };
}

export function controleerSamenhang(p: Project): Validatiefout[] {
  const fouten: Validatiefout[] = [];
  const ids = new Set<string>();
  const uniek = (x: string, pad: string) => {
    if (ids.has(x)) fouten.push({ pad, melding: `id '${x}' komt meermaals voor` });
    ids.add(x);
  };
  p.verdiepingen.forEach((v, vi) => {
    uniek(v.id, `verdiepingen.${vi}`);
    const muren = new Map(v.muren.map((m) => [m.id, m]));
    v.muren.forEach((m, mi) => {
      uniek(m.id, `verdiepingen.${vi}.muren.${mi}`);
      if (m.start.x === m.eind.x && m.start.y === m.eind.y)
        fouten.push({ pad: `verdiepingen.${vi}.muren.${mi}`, melding: "muur heeft lengte 0" });
    });
    v.openingen.forEach((o, oi) => {
      const pad = `verdiepingen.${vi}.openingen.${oi}`;
      uniek(o.id, pad);
      const m = muren.get(o.muurId);
      if (!m) return void fouten.push({ pad, melding: `muur '${o.muurId}' bestaat niet` });
      const lengte = Math.hypot(m.eind.x - m.start.x, m.eind.y - m.start.y);
      if (o.offset + o.breedte > lengte + 0.5)
        fouten.push({ pad, melding: `opening valt buiten muur '${m.id}'` });
      if (o.borstwering + o.hoogte > m.hoogte)
        fouten.push({ pad, melding: `opening is hoger dan muur '${m.id}'` });
    });
    v.ruimtes.forEach((r, ri) => {
      const pad = `verdiepingen.${vi}.ruimtes.${ri}`;
      uniek(r.id, pad);
      r.muurIds.forEach((mid) => {
        if (!muren.has(mid)) fouten.push({ pad, melding: `muur '${mid}' bestaat niet` });
      });
    });
  });
  return fouten;
}
