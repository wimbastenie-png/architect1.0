/**
 * Lastenboek-meetstaat: hoeveelheden per post en per ruimte, om in een
 * offerte over te nemen. Eigen indeling — NIET de nummering van
 * Standaardbestek 250 of een ander officieel bestek.
 *
 * Aannames (staan ook in de export):
 * - wandvlak = omtrek × plafondhoogte − openingen (zie ruimteWandVlak)
 * - plafond = vloeroppervlak (vlakke plafonds)
 * - plinten = omtrek − breedte van deuren en doorgangen in de muren van de ruimte
 * - dagkanten in lopende meter (2 × hoogte + breedte) voor openingen in buitenmuren;
 *   de diepte hangt af van de plaats van het schrijnwerk en wordt niet geraamd
 * - vensterbanken = breedte van ramen met borstwering in buitenmuren
 * - binnendeuren één keer geteld, bij de eerste ruimte waaraan ze grenzen
 */
import { m2, omtrek, oppervlakte, ruimteWandVlak } from "./geometrie.ts";
import type { Project } from "./schema.ts";

export type Eenheid = "m²" | "m" | "st";

export interface PostDefinitie {
  code: string;
  omschrijving: string;
  eenheid: Eenheid;
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

export const LASTENBOEK_AANNAMES =
  "Hoeveelheden ter indicatie, berekend uit de opmeting; na te meten vóór bestelling. Eigen postindeling, niet volgens Standaardbestek 250. " +
  "Wanden = omtrek × plafondhoogte min openingen; plafond = vloer; plinten = omtrek min deuren; dagkanten in lopende meter (2 × hoogte + breedte), zonder diepte.";

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
      const vloer = m2(oppervlakte(r.contour));
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
        "01": vloer, "02": plint, "03": wand, "04": vloer, "05": dagkant,
        "06": wand, "07": vloer, "08": vensterbank, "09": schrijnwerk, "10": binnendeuren,
      };
      for (const post of POSTEN) {
        const h = r2(waarden[post.code] ?? 0);
        if (h > 0) regels.push({ ...post, verdieping: v.naam, ruimte: r.naam, hoeveelheid: h });
      }
    }
  }
  const totalen = POSTEN.map((post) => ({
    ...post,
    hoeveelheid: r2(regels.filter((x) => x.code === post.code).reduce((s, x) => s + x.hoeveelheid, 0)),
  })).filter((t) => t.hoeveelheid > 0);
  return { regels, totalen };
}

const getal = (x: number, eenheid: Eenheid) => (eenheid === "st" ? String(Math.round(x)) : x.toFixed(2).replace(".", ","));
const tekst = (s: string) => (/[;"\n\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/**
 * CSV voor Belgische Excel (`;`, decimale komma). Bovenaan de totalen per post
 * met kolommen voor eenheidsprijs en totaal (formule), daaronder het detail per ruimte.
 */
export function lastenboekCSV(lb: Lastenboek, projectnaam: string): string {
  const r: string[] = [];
  r.push(["Post", "Omschrijving", "Eenheid", "Hoeveelheid", "Eenheidsprijs (EUR)", "Totaal (EUR)"].join(";"));
  lb.totalen.forEach((t, i) => {
    const rij = i + 2; // Excel-rijnummer (rij 1 = kop)
    r.push([t.code, tekst(t.omschrijving), t.eenheid, getal(t.hoeveelheid, t.eenheid), "", `=D${rij}*E${rij}`].join(";"));
  });
  // gewone optelling i.p.v. SUM/SOM: werkt in elke taalversie van Excel
  const som = lb.totalen.map((_, i) => `F${i + 2}`).join("+") || "0";
  r.push(["", "Totaal excl. btw", "", "", "", `=${som}`].join(";"));
  r.push("");
  r.push(["Detail per ruimte"].join(";"));
  r.push(["Post", "Omschrijving", "Verdieping", "Ruimte", "Eenheid", "Hoeveelheid"].join(";"));
  for (const x of lb.regels) r.push([x.code, tekst(x.omschrijving), tekst(x.verdieping), tekst(x.ruimte), x.eenheid, getal(x.hoeveelheid, x.eenheid)].join(";"));
  r.push("");
  r.push(tekst(`Project: ${projectnaam}`));
  r.push(tekst(LASTENBOEK_AANNAMES));
  return "﻿" + r.join("\r\n") + "\r\n";
}

/** Tab-gescheiden totalen om te plakken in een offerteprogramma of Excel. */
export function lastenboekTSV(lb: Lastenboek): string {
  return lb.totalen.map((t) => [t.code, t.omschrijving, t.eenheid, getal(t.hoeveelheid, t.eenheid)].join("\t")).join("\n") + "\n";
}
