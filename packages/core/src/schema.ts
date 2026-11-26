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
  "overgenomen", // gekopieerd (bv. van de verdieping eronder), nog niet gemeten
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

/**
 * Ontwerp (verbouwing): bestaand blijft, afbreken (geel op plan), nieuw (rood).
 * Openingen: nieuw = nieuwe opening in een bestaande muur; dicht = bestaande opening dichtmaken.
 */
/** EPB/EPC: samenstelling van een muur, vloer of dak (lagen van binnen naar buiten). */
export const Laag = z.object({ materiaal: z.string(), dikte: mm.positive(), lambda: z.number().positive().optional(), r: z.number().positive().optional() });
export type Laag = z.infer<typeof Laag>;
export const Grens = z.enum(["buiten", "grond", "onverwarmd", "buren", "binnen"]);
export type Grens = z.infer<typeof Grens>;
export const Samenstelling = z.object({
  grens: Grens.optional(),
  lagen: z.array(Laag).default([]),
  /** U-waarde (W/m²K) zelf ingegeven (bv. uit een EPB-verslag of een fiche); anders berekend uit de lagen. */
  uIngegeven: z.number().positive().optional(),
  /** Bron van de gegevens: vaststelling, factuur, technische fiche, aanname … */
  bron: z.string().optional(),
  fotos: z.array(z.string()).default([]),
});
export type Samenstelling = z.infer<typeof Samenstelling>;

export const MuurToestand = z.enum(["bestaand", "afbreken", "nieuw"]);
export type MuurToestand = z.infer<typeof MuurToestand>;
export const OpeningToestand = z.enum(["bestaand", "nieuw", "dicht"]);
export type OpeningToestand = z.infer<typeof OpeningToestand>;

export const Muur = z.object({
  id,
  start: Punt,
  eind: Punt,
  dikte: mmPositief,
  hoogte: mmPositief,
  dragend: Dragend.default("onbekend"),
  bron: Bron,
  /** Ontwerp: leeg = bestaand. */
  toestand: MuurToestand.optional(),
  epb: Samenstelling.optional(),
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
  /** Ontwerp: leeg = bestaand. */
  toestand: OpeningToestand.optional(),
  /** EPB/EPC: glas, schrijnwerk, zonwering. */
  epb: z.object({
    glas: z.string().optional(),
    ug: z.number().positive().optional(),
    schrijnwerk: z.string().optional(),
    uf: z.number().positive().optional(),
    uw: z.number().positive().optional(),
    zonwering: z.enum(["geen", "binnen", "screen", "rolluik", "buitenjaloezie", "overstek"]).optional(),
    bron: z.string().optional(),
    fotos: z.array(z.string()).default([]),
  }).optional(),
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
  /** Vrije notities van de werf (vocht, stopcontacten, opmerkingen klant …). */
  notities: z.string().optional(),
  /** Functie (ventilatie, warmteverlies); leeg = afgeleid uit de naam. */
  functie: z.enum(["woonkamer", "keuken", "open-keuken", "slaapkamer", "studeerkamer", "badkamer", "wc", "washok", "berging", "gang", "andere"]).optional(),
  /** EPB: binnen het beschermd volume (standaard ja). */
  beschermd: z.boolean().optional(),
  /** Inrichting: materiaal van vloer en wanden (sleutels uit MATERIALEN in inrichting.ts). */
  afwerking: z.object({ vloer: z.string().optional(), wand: z.string().optional() }).optional(),
});
export type Ruimte = z.infer<typeof Ruimte>;

/**
 * Sparing = gat in de vloer van deze verdieping (trapgat, vide, schacht).
 * Wordt afgetrokken van de vloer van deze verdieping en van het plafond
 * van de verdieping eronder.
 */
export const Sparing = z.object({
  id,
  soort: z.enum(["trapgat", "vide", "schacht"]),
  /** Contour in plancoördinaten (mm), tegen de klok in. */
  contour: z.array(Punt).min(3),
  bron: Bron,
});
export type Sparing = z.infer<typeof Sparing>;

/**
 * Installatiepunt op het plan: stopcontact, lichtpunt, wastafel, gasketel …
 * Leidingen en kringen worden hieruit berekend (zie installaties.ts).
 */
export const InstallatiePunt = z.object({
  id,
  net: z.enum(["elektriciteit", "sanitair", "gas", "ventilatie", "verwarming"]),
  /** Soort toestel of punt (zie SOORTEN in installaties.ts). */
  soort: z.string().min(1),
  positie: Punt,
  /** Hoogte boven de afgewerkte vloer (mm). */
  hoogte: mm.nonnegative(),
  /** Vaste kring (bv. "K3"); leeg = automatisch ingedeeld. */
  kring: z.string().optional(),
  opmerking: z.string().optional(),
});
export type InstallatiePunt = z.infer<typeof InstallatiePunt>;

/** Meubel of toestel op het plan (inrichting). Positie = midden, hoek in graden (tegen de klok in). */
export const Meubel = z.object({
  id,
  soort: z.string().min(1),
  positie: Punt,
  hoek: z.number().default(0),
  breedte: mmPositief,
  diepte: mmPositief,
  hoogte: mmPositief,
  kleur: z.string().optional(),
});
export type Meubel = z.infer<typeof Meubel>;

export const Verdieping = z.object({
  id,
  naam: z.string(),
  /** Peil van de vloer t.o.v. referentiepeil 0, in mm. */
  peil: mm.default(0),
  muren: z.array(Muur).default([]),
  openingen: z.array(Opening).default([]),
  ruimtes: z.array(Ruimte).default([]),
  sparingen: z.array(Sparing).default([]),
  installaties: z.array(InstallatiePunt).default([]),
  meubels: z.array(Meubel).default([]),
  /** Rechte trappen die op deze verdieping vertrekken. */
  trappen: z.array(z.object({
    id,
    /** Onderaan de trap, midden van de eerste trede (plan-mm). */
    start: Punt,
    /** Looprichting naar boven, in graden (0 = plan-x, 90 = plan-y). */
    richting: z.number(),
    breedte: mmPositief,
    treden: z.number().int().min(2).max(30),
    /** Optrede en aantrede (mm). */
    optrede: mmPositief,
    aantrede: mmPositief,
  })).default([]),
  /** Ruimte-indeling van de NIEUWE toestand (na afbreken en nieuwe muren); leeg = zelfde als bestaand. */
  ruimtesNieuw: z.array(Ruimte).optional(),
  /** EPB: vloer (onderkant) en plafond/dak (bovenkant) van deze verdieping. */
  epb: z.object({ vloer: Samenstelling.optional(), plafond: Samenstelling.optional() }).optional(),
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
  notities: z.string().optional(),
  aangemaakt: z.string().datetime(),
  gewijzigd: z.string().datetime(),
  verdiepingen: z.array(Verdieping).min(1),
  /** Voordimensionering stalen liggers (invoer; resultaten worden telkens herberekend). */
  liggers: z.array(z.object({
    id,
    naam: z.string(),
    dagmaat: mmPositief,
    oplegging: mmPositief,
    staal: z.enum(["S235", "S355"]),
    aantal: z.number().int().min(1).max(4),
    kipVerhinderd: z.boolean(),
    doorbuiging: z.number().positive(),
    lasten: z.array(z.object({ omschrijving: z.string(), soort: z.enum(["G", "Q", "S"]), waarde: z.number().nonnegative() })),
    reeksen: z.array(z.enum(["IPE", "HEA", "HEB"])).optional(),
    muurId: z.string().optional(),
    puntlasten: z.array(z.object({ omschrijving: z.string(), soort: z.enum(["G", "Q", "S"]), waarde: z.number().nonnegative(), a: z.number().nonnegative() })).optional(),
    tweede: mmPositief.optional(),
    metselwerkFd: z.number().positive().optional(),
  })).default([]),
  /** Stalen kolommen (voordimensionering, eenvoudige knikcontrole). */
  kolommen: z.array(z.object({
    id,
    naam: z.string(),
    /** Kniklengte (mm), bv. de verdiepingshoogte. */
    lengte: mmPositief,
    staal: z.enum(["S235", "S355"]),
    /** Karakteristieke normaalkracht: permanent en variabel (kN), of uit de reactie van een ligger. */
    gk: z.number().nonnegative().default(0),
    qk: z.number().nonnegative().default(0),
    liggerId: z.string().optional(),
    reeksen: z.array(z.enum(["IPE", "HEA", "HEB"])).optional(),
  })).default([]),
  /** Keuken en maatwerk: per wand (rand van een ruimte) de precisiemeting, kasten en aansluitingen. */
  maatwerk: z.array(z.object({
    id,
    ruimteId: id,
    /** Index van de rand in de ruimtecontour (rand k loopt van contour[k] naar contour[k+1]). */
    rand: z.number().int().nonnegative(),
    meting: z.object({
      /** Lengte van de wand op 3 hoogtes (mm): bij de vloer, op ± 900 mm, tegen het plafond. */
      onder: mm.positive().optional(),
      midden: mm.positive().optional(),
      boven: mm.positive().optional(),
      /** Afwijking van haaks in de linker- en rechterhoek (graden, + = hoek groter dan 90°). */
      hoekLinks: z.number().optional(),
      hoekRechts: z.number().optional(),
      /** Vloer: hoogteverschil over de lengte van de wand (mm, + = rechts hoger). */
      vloerVerschil: mm.optional(),
      /** Muur uit het lood over de hoogte (mm, + = bovenaan naar voren). */
      lood: mm.optional(),
      methode: MeetMethode.default("laser"),
    }).default({ methode: "laser" }),
    kasten: z.array(z.object({
      id,
      soort: z.enum(["onder", "boven", "hoog"]),
      functie: z.enum(["kast", "lades", "spoelbak", "kookplaat", "vaatwas", "oven", "koelkast", "dampkap", "vulstuk"]).default("kast"),
      x: mm.nonnegative(),
      breedte: mmPositief,
      hoogte: mmPositief.optional(),
      diepte: mmPositief.optional(),
    })).default([]),
    /** Aansluitingen die (nog) niet als installatiepunt op het plan staan: radiator, water, afvoer, gas, stopcontact. */
    aansluitingen: z.array(z.object({ soort: z.enum(["radiator", "koud", "warm", "afvoer", "gas", "stopcontact", "dampkap-afvoer"]), x: mm.nonnegative(), hoogte: mm.nonnegative(), breedte: mm.positive().optional(), hoogteObject: mm.positive().optional() })).default([]),
  })).default([]),
  /** Dak boven de bovenste verdieping (vergunningsklare basis). */
  dak: z.object({
    soort: z.enum(["plat", "zadel", "lessenaar"]),
    /** Hellingshoek in graden (plat: 0). */
    helling: z.number().min(0).max(75).default(35),
    /** Richting van de nok of van de helling: "x" = nok evenwijdig met plan-x. */
    nok: z.enum(["x", "y"]).default("x"),
    overstek: mm.nonnegative().default(300),
    dikte: mmPositief.default(300),
    materiaal: z.string().optional(),
  }).optional(),
  /** Terrein: perceel (plan-mm, tegen de klok in) en maaiveldpeil t.o.v. ±0. */
  terrein: z.object({ perceel: z.array(Punt).min(3), maaiveld: mm.default(0), straat: z.string().optional() }).optional(),
  /** Vergunningsplan: gegevens voor het titelblok. */
  vergunning: z.object({
    bouwheer: z.string().optional(),
    architect: z.string().optional(),
    kadaster: z.string().optional(),
    planNummer: z.string().optional(),
    index: z.string().optional(),
  }).optional(),
  /** Gevelmaterialen per zijde (voor, achter, links, rechts). */
  gevelmaterialen: z.record(z.string(), z.string()).optional(),
  /** Opmerkingen (pins) op het plan, zichtbaar voor iedereen met wie het project gedeeld is. */
  opmerkingen: z.array(z.object({ id, verdiepingId: id, positie: Punt, tekst: z.string(), auteur: z.string().optional(), datum: z.string(), opgelost: z.boolean().optional() })).default([]),
  /** Verwarming: ontwerpbuitentemperatuur, afgiftesysteem per ruimte, zonnepanelen. */
  verwarming: z.object({
    buitentemperatuur: z.number().default(-7),
    /** Afgifte per ruimte-id: radiatoren of vloerverwarming (standaard radiatoren). */
    afgifte: z.record(z.string(), z.enum(["radiator", "vloer"])).default({}),
    /** Aanvoer/retour: hoge temperatuur (75/65) of lage temperatuur (45/35, warmtepomp). */
    regime: z.enum(["75/65", "55/45", "45/35"]).default("45/35"),
    zonnepanelen: z.boolean().default(false),
  }).optional(),
  /** Ventilatie: gekozen systeem (A natuurlijk, B mechanische toevoer, C mechanische afvoer, D balans). */
  ventilatie: z.object({ systeem: z.enum(["A", "B", "C", "D"]) }).optional(),
  /** Oriëntatie: richting van het noorden op het plan, in graden met de klok mee vanaf "boven" (0 = noorden boven). */
  noord: z.number().default(0),
  /** Bewijsfoto's (EPB, werf): metadata; de beelden zelf staan op het toestel (IndexedDB). */
  fotos: z.array(z.object({ id, datum: z.string(), element: z.string().optional(), ruimteId: z.string().optional(), bijschrift: z.string().optional(), soort: z.enum(["epb", "werf"]).default("epb") })).default([]),
  /** Ontwerp: snijlijnen voor doorsneden (plan-mm, over alle verdiepingen). */
  doorsneden: z.array(z.object({ id, naam: z.string(), a: Punt, b: Punt })).default([]),
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
    (v.sparingen ?? []).forEach((sp, si) => uniek(sp.id, `verdiepingen.${vi}.sparingen.${si}`));
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
