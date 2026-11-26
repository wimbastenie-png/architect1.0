/**
 * Extra lastenboekposten, berekend uit het ontwerp (afbraak en ruwbouw), de
 * liggers en de installaties. Hoeveelheden ter indicatie, voor de offerte van
 * de aannemer; na te meten. Alle aannames staan bij de post (toelichting) en
 * in AANNAMES_EXTRA.
 */
import { rekenLigger } from "./liggers.ts";
import { materiaallijst } from "./installaties.ts";
import { muurLengte } from "./geometrie.ts";
import { vloerNetto } from "./bewerken.ts";
import { heeftOntwerp, muurToestand, openingToestand } from "./ontwerp.ts";
import type { Eenheid } from "./lastenboek.ts";
import type { Muur, Project, Verdieping } from "./schema.ts";

export interface ExtraPost {
  code: string;
  groep: "Afbraak" | "Ruwbouw" | "Elektriciteit" | "Sanitair" | "Gas";
  omschrijving: string;
  eenheid: Eenheid;
  hoeveelheid: number;
  toelichting?: string;
}

/** Aannames (staan ook in de Excel en de PDF). */
export const LOSHEID_PUIN = 1.4; // vast → los volume
export const DICHTHEID_METSELWERK = 1.8; // ton per m³ (vast)
export const CONTAINER_M3 = 10;
export const OPLEG_LATEI = 200; // mm aan elke kant
export const AANNAMES_EXTRA =
  `Afbraak: muuroppervlak = hartlijnlengte × hoogte min openingen; puin los = vast volume × ${String(LOSHEID_PUIN).replace(".", ",")}; ` +
  `${String(DICHTHEID_METSELWERK).replace(".", ",")} ton/m³; containers van ${CONTAINER_M3} m³; stutten ± 1 per meter muur + 1 (aantal en plaats bepaalt de ingenieur). ` +
  `Ruwbouw: lateien = opening + 2 × ${OPLEG_LATEI} mm oplegging; chape = netto vloer van alle ruimtes (schrap wat niet nodig is). Installaties: uit de materiaallijst (schatting).`;

const r2 = (x: number) => Math.round(x * 100) / 100;
const r3 = (x: number) => Math.round(x * 1000) / 1000;

function muurNetto(m: Muur, v: Verdieping, filter: (t: ReturnType<typeof openingToestand>) => boolean = () => true): number {
  const gat = v.openingen.filter((o) => o.muurId === m.id && filter(openingToestand(o))).reduce((s, o) => s + o.breedte * Math.min(o.hoogte, m.hoogte - o.borstwering), 0);
  return Math.max(0, muurLengte(m) * m.hoogte - gat); // mm²
}

export function extraPosten(p: Project): ExtraPost[] {
  const uit: ExtraPost[] = [];
  const zet = (x: ExtraPost) => { if (x.hoeveelheid > 0) uit.push({ ...x, hoeveelheid: x.eenheid === "st" ? Math.round(x.hoeveelheid) : r2(x.hoeveelheid) }); };

  // ---- afbraak
  let afbraakM2 = 0, afbraakM3 = 0, stutten = 0, gatM2 = 0, gatM3 = 0;
  for (const v of p.verdiepingen) {
    for (const m of v.muren) {
      if (muurToestand(m) !== "afbreken") continue;
      const a = muurNetto(m, v, (t) => t !== "nieuw");
      afbraakM2 += a / 1e6;
      afbraakM3 += (a * m.dikte) / 1e9;
      if (m.dragend !== "niet-dragend") stutten += Math.ceil(muurLengte(m) / 1000) + 1;
    }
    for (const o of v.openingen) {
      const m = v.muren.find((x) => x.id === o.muurId);
      if (!m || openingToestand(o) !== "nieuw" || muurToestand(m) !== "bestaand") continue;
      const a = o.breedte * Math.min(o.hoogte, m.hoogte - o.borstwering);
      gatM2 += a / 1e6;
      gatM3 += (a * m.dikte) / 1e9;
      if (m.dragend !== "niet-dragend") stutten += Math.ceil((o.breedte + 2 * OPLEG_LATEI) / 1000) + 1;
    }
  }
  const vast = afbraakM3 + gatM3;
  zet({ code: "A01", groep: "Afbraak", omschrijving: "Afbreken muren", eenheid: "m²", hoeveelheid: afbraakM2, toelichting: "hartlijnlengte × hoogte min openingen" });
  zet({ code: "A02", groep: "Afbraak", omschrijving: "Uitbreken nieuwe openingen in bestaande muren", eenheid: "m²", hoeveelheid: gatM2 });
  zet({ code: "A03", groep: "Afbraak", omschrijving: "Afbraakvolume (vast)", eenheid: "m³", hoeveelheid: r3(vast) });
  zet({ code: "A04", groep: "Afbraak", omschrijving: "Puin, los volume", eenheid: "m³", hoeveelheid: vast * LOSHEID_PUIN, toelichting: `vast × ${LOSHEID_PUIN}` });
  zet({ code: "A05", groep: "Afbraak", omschrijving: "Puin, gewicht", eenheid: "ton", hoeveelheid: vast * DICHTHEID_METSELWERK, toelichting: `${DICHTHEID_METSELWERK} t/m³` });
  zet({ code: "A06", groep: "Afbraak", omschrijving: `Container ${CONTAINER_M3} m³ (schatting)`, eenheid: "st", hoeveelheid: vast > 0 ? Math.ceil((vast * LOSHEID_PUIN) / CONTAINER_M3) : 0 });
  zet({ code: "A07", groep: "Afbraak", omschrijving: "Stutten bij (mogelijk) dragende muren (aantal en plaats: ingenieur)", eenheid: "st", hoeveelheid: stutten });

  // ---- ruwbouw
  const perDikte = new Map<number, number>();
  const lateien = new Map<number, number>(); // lengte → aantal
  let dicht = 0;
  for (const v of p.verdiepingen) {
    for (const m of v.muren) if (muurToestand(m) === "nieuw") perDikte.set(m.dikte, (perDikte.get(m.dikte) ?? 0) + muurNetto(m, v) / 1e6);
    for (const o of v.openingen) {
      const m = v.muren.find((x) => x.id === o.muurId);
      if (!m) continue;
      const t = openingToestand(o);
      if (t === "dicht") dicht += (o.breedte * Math.min(o.hoogte, m.hoogte - o.borstwering)) / 1e6;
      // latei bij een nieuwe opening, of een opening in een nieuwe muur (tenzij er een ligger voor berekend is)
      const ligger = p.liggers.some((l) => l.muurId === m.id && Math.abs(l.dagmaat - o.breedte) < 5);
      if (!ligger && t !== "dicht" && (t === "nieuw" || muurToestand(m) === "nieuw")) {
        const L = Math.ceil((o.breedte + 2 * OPLEG_LATEI) / 100) * 100;
        lateien.set(L, (lateien.get(L) ?? 0) + 1);
      }
    }
  }
  for (const [d, m2] of [...perDikte].sort((a, b) => a[0] - b[0])) zet({ code: `R01-${d}`, groep: "Ruwbouw", omschrijving: `Metselwerk nieuwe muren, dikte ${d} mm`, eenheid: "m²", hoeveelheid: m2 });
  for (const [L, n] of [...lateien].sort((a, b) => a[0] - b[0])) zet({ code: `R02-${L}`, groep: "Ruwbouw", omschrijving: `Latei L = ${L} mm (type volgens muur en last)`, eenheid: "st", hoeveelheid: n });
  for (const l of p.liggers) {
    const r = rekenLigger(l);
    if (!r.keuze) continue;
    const L = Math.ceil((l.dagmaat + 2 * l.oplegging) / 100) * 100;
    zet({ code: `R03-${r.keuze.profiel.naam.replace(" ", "")}-${L}`, groep: "Ruwbouw", omschrijving: `Stalen ligger ${r.keuze.profiel.naam} ${l.staal}, L = ${L} mm (voorstel, af te tekenen door de ingenieur)`, eenheid: "st", hoeveelheid: l.aantal });
  }
  zet({ code: "R04", groep: "Ruwbouw", omschrijving: "Dichtmaken van openingen (metselwerk)", eenheid: "m²", hoeveelheid: dicht });
  // chape: bij een verbouwing alle ruimtes, anders alleen ruimtes waarvoor een nieuwe vloer gekozen is
  const verbouwing = heeftOntwerp(p);
  const chape = p.verdiepingen.reduce((s, v) => s + v.ruimtes.filter((r) => verbouwing || r.afwerking?.vloer).reduce((t, r) => t + vloerNetto(r, v), 0), 0) / 1e6;
  zet({ code: "R05", groep: "Ruwbouw", omschrijving: verbouwing ? "Chape en vloeropbouw (alle ruimtes; schrap wat niet nodig is)" : "Chape en vloeropbouw (ruimtes met een gekozen vloer)", eenheid: "m²", hoeveelheid: chape });

  // ---- installaties (uit de materiaallijst)
  const groep = { elektriciteit: "Elektriciteit", sanitair: "Sanitair", gas: "Gas" } as const;
  const letter = { elektriciteit: "E", sanitair: "S", gas: "G" } as const;
  for (const m of materiaallijst(p)) {
    // vaste code per omschrijving: een ingegeven prijs blijft bij dezelfde post
    zet({ code: `${letter[m.net]}-${kort(m.omschrijving)}`, groep: groep[m.net], omschrijving: m.omschrijving, eenheid: m.eenheid, hoeveelheid: m.hoeveelheid });
  }
  return uit;
}

/** Korte, vaste code (4 tekens) uit een tekst. */
function kort(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(36).toUpperCase().padStart(4, "0").slice(-4);
}
