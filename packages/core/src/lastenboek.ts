/**
 * Lastenboek-meetstaat: hoeveelheden per post en per ruimte, om in een
 * offerte over te nemen. Eigen indeling — NIET de nummering van
 * Standaardbestek 250 of een ander officieel bestek.
 *
 * Aannames (staan ook in de export):
 * - wandvlak = omtrek × plafondhoogte − openingen (zie ruimteWandVlak)
 * - vloer netto (min trapgat/vide/schacht); plafond = ruimte min sparingen in de verdieping erboven (vlakke plafonds)
 * - plinten = omtrek − breedte van deuren en doorgangen in de muren van de ruimte
 * - dagkanten in lopende meter (2 × hoogte + breedte) voor openingen in buitenmuren;
 *   de diepte hangt af van de plaats van het schrijnwerk en wordt niet geraamd
 * - vensterbanken = breedte van ramen met borstwering in buitenmuren
 * - binnendeuren één keer geteld, bij de eerste ruimte waaraan ze grenzen
 */
import { plafondNetto, vloerNetto } from "./bewerken.ts";
import { m2, omtrek, ruimteWandVlak } from "./geometrie.ts";
import { AANNAMES_EXTRA, extraPosten } from "./lastenboek-extra.ts";
import type { Prijzen } from "./prijzen.ts";
import type { Project } from "./schema.ts";

export type Eenheid = "m²" | "m" | "st" | "m³" | "ton";

export interface PostDefinitie {
  code: string;
  omschrijving: string;
  eenheid: Eenheid;
  /** Groep voor de extra posten (Afbraak, Ruwbouw, Elektriciteit …); leeg = afwerking per ruimte. */
  groep?: string;
  toelichting?: string;
}

export const POSTEN: PostDefinitie[] = [
  { code: "01", omschrijving: "Vloerafwerking", eenheid: "m²" },
  { code: "02", omschrijving: "Plinten", eenheid: "m" },
  { code: "03", omschrijving: "Pleisterwerk wanden", eenheid: "m²" },
  { code: "04", omschrijving: "Pleisterwerk plafond", eenheid: "m²" },
  { code: "05", omschrijving: "Dagkanten (pleisterwerk)", eenheid: "m" },
  { code: "06", omschrijving: "Schilderwerk wanden", eenheid: "m²" },
  { code: "07", omschrijving: "Schilderwerk plafond", eenheid: "m²" },
  { code: "08", omschrijving: "Vensterbanken", eenheid: "m" },
  { code: "09", omschrijving: "Buitenschrijnwerk (ramen en buitendeuren)", eenheid: "m²" },
  { code: "10", omschrijving: "Binnendeuren", eenheid: "st" },
];

/** Vaste zin in elke export: de app bereidt voor, een vakman controleert. */
export const VAKMAN_ZIN = "De app bereidt voor; een bevoegde vakman controleert en tekent af. De app geeft nooit een oordeel 'conform'.";

export const LASTENBOEK_AANNAMES =
  "Hoeveelheden ter indicatie, berekend uit de opmeting; na te meten vóór bestelling. Eigen postindeling, niet volgens Standaardbestek 250. " +
  "Wanden = omtrek × plafondhoogte min openingen; vloer en plafond netto (min trapgaten), vlakke plafonds; plinten = omtrek min deuren; dagkanten in lopende meter (2 × hoogte + breedte), zonder diepte.";

export interface LastenboekRegel extends PostDefinitie {
  verdieping: string;
  ruimte: string;
  hoeveelheid: number;
}

export interface Lastenboek {
  regels: LastenboekRegel[];
  totalen: Array<PostDefinitie & { hoeveelheid: number }>;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

export function lastenboek(p: Project): Lastenboek {
  const regels: LastenboekRegel[] = [];
  const geteldeDeuren = new Set<string>();
  for (const v of p.verdiepingen) {
    const aantalRuimtes = new Map<string, number>();
    for (const r of v.ruimtes) for (const id of r.muurIds) aantalRuimtes.set(id, (aantalRuimtes.get(id) ?? 0) + 1);
    for (const r of v.ruimtes) {
      const eigen = v.openingen.filter((o) => r.muurIds.includes(o.muurId));
      const buiten = eigen.filter((o) => (aantalRuimtes.get(o.muurId) ?? 0) < 2);
      const vloer = m2(vloerNetto(r, v));
      const plafond = m2(plafondNetto(r, v, p));
      const wand = m2(ruimteWandVlak(r, v).netto);
      const deurBreedte = eigen.filter((o) => o.soort !== "raam").reduce((s, o) => s + o.breedte, 0);
      const plint = Math.max(0, omtrek(r.contour) - deurBreedte) / 1000;
      const dagkant = buiten.reduce((s, o) => s + (2 * Math.min(o.hoogte, r.plafondhoogte - o.borstwering) + o.breedte), 0) / 1000;
      const vensterbank = buiten.filter((o) => o.soort === "raam" && o.borstwering > 0).reduce((s, o) => s + o.breedte, 0) / 1000;
      const schrijnwerk = buiten.filter((o) => o.soort !== "doorgang").reduce((s, o) => s + o.breedte * o.hoogte, 0) / 1e6;
      let binnendeuren = 0;
      for (const o of eigen) {
        if (o.soort === "deur" && (aantalRuimtes.get(o.muurId) ?? 0) >= 2 && !geteldeDeuren.has(o.id)) {
          geteldeDeuren.add(o.id);
          binnendeuren++;
        }
      }
      const waarden: Record<string, number> = {
        "01": vloer, "02": plint, "03": wand, "04": plafond, "05": dagkant,
        "06": wand, "07": plafond, "08": vensterbank, "09": schrijnwerk, "10": binnendeuren,
      };
      for (const post of POSTEN) {
        const h = r2(waarden[post.code] ?? 0);
        if (h > 0) regels.push({ ...post, verdieping: v.naam, ruimte: r.naam, hoeveelheid: h });
      }
    }
  }
  const totalen: Lastenboek["totalen"] = POSTEN.map((post) => ({
    ...post,
    groep: "Afwerking",
    hoeveelheid: r2(regels.filter((x) => x.code === post.code).reduce((s, x) => s + x.hoeveelheid, 0)),
  })).filter((t) => t.hoeveelheid > 0);
  totalen.push(...extraPosten(p));
  return { regels, totalen };
}

const getal = (x: number, eenheid: Eenheid) => (eenheid === "st" ? String(Math.round(x)) : x.toFixed(2).replace(".", ","));
const tekst = (s: string) => (/[;"\n\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/**
 * CSV voor Belgische Excel (`;`, decimale komma). Bovenaan de totalen per post
 * met kolommen voor eenheidsprijs en totaal (formule), daaronder het detail per ruimte.
 */
export function lastenboekCSV(lb: Lastenboek, projectnaam: string, prijzen: Prijzen = {}, btwPct?: number): string {
  const r: string[] = [];
  r.push(["Post", "Omschrijving", "Eenheid", "Hoeveelheid", "Eenheidsprijs (EUR)", "Totaal (EUR)"].join(";"));
  lb.totalen.forEach((t, i) => {
    const rij = i + 2; // Excel-rijnummer (rij 1 = kop)
    const prijs = prijzen[t.code];
    r.push([t.code, tekst(t.omschrijving), t.eenheid, getal(t.hoeveelheid, t.eenheid), prijs === undefined ? "" : prijs.toFixed(2).replace(".", ","), `=D${rij}*E${rij}`].join(";"));
  });
  // gewone optelling i.p.v. SUM/SOM: werkt in elke taalversie van Excel
  const som = lb.totalen.map((_, i) => `F${i + 2}`).join("+") || "0";
  r.push(["", "Totaal excl. btw", "", "", "", `=${som}`].join(";"));
  if (btwPct !== undefined) {
    const t = lb.totalen.length + 2; // rij van "Totaal excl. btw"
    r.push(["", `Btw ${btwPct} %`, "", "", "", `=F${t}*${btwPct}/100`].join(";"));
    r.push(["", "Totaal incl. btw", "", "", "", `=F${t}+F${t + 1}`].join(";"));
  }
  r.push("");
  r.push(["Detail per ruimte"].join(";"));
  r.push(["Post", "Omschrijving", "Verdieping", "Ruimte", "Eenheid", "Hoeveelheid"].join(";"));
  for (const x of lb.regels) r.push([x.code, tekst(x.omschrijving), tekst(x.verdieping), tekst(x.ruimte), x.eenheid, getal(x.hoeveelheid, x.eenheid)].join(";"));
  r.push("");
  r.push(tekst(`Project: ${projectnaam}`));
  r.push(tekst(LASTENBOEK_AANNAMES));
  if (lb.totalen.some((t) => t.groep && t.groep !== "Afwerking")) r.push(tekst(AANNAMES_EXTRA));
  r.push(tekst(VAKMAN_ZIN));
  return "﻿" + r.join("\r\n") + "\r\n";
}

/** Tab-gescheiden totalen om te plakken in een offerteprogramma of Excel. */
export function lastenboekTSV(lb: Lastenboek, prijzen: Prijzen = {}): string {
  const metPrijs = lb.totalen.some((t) => prijzen[t.code] !== undefined);
  return lb.totalen.map((t) => {
    const basis = [t.code, t.omschrijving, t.eenheid, getal(t.hoeveelheid, t.eenheid)];
    if (!metPrijs) return basis.join("\t");
    const p = prijzen[t.code];
    const bedrag = p === undefined ? "" : (Math.round(t.hoeveelheid * p * 100) / 100).toFixed(2).replace(".", ",");
    return [...basis, p === undefined ? "" : p.toFixed(2).replace(".", ","), bedrag].join("\t");
  }).join("\n") + "\n";
}
