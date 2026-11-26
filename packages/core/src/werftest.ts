/**
 * Werftestprotocol: controlemetingen op de werf tegenover de maten in het plan,
 * met statistiek per soort maat. Zo weet je hoe nauwkeurig een opmeting (met
 * rolmeter, laser, camera of scan) werkelijk is.
 *
 * Het rapport geeft feiten (verschillen en statistiek), geen oordeel over de
 * werken: de vakman beslist of de nauwkeurigheid volstaat voor zijn doel.
 */
import { binnenLengte, binnenmaten } from "./geometrie.ts";
import type { Project } from "./schema.ts";

export type Werftest = NonNullable<Project["werftest"]>;
export type Controlemeting = Werftest["metingen"][number];

export const SOORT_MAAT: Record<Controlemeting["soort"], string> = {
  muur: "binnenmaat muur", plafond: "plafondhoogte", "opening-breedte": "breedte opening", "opening-hoogte": "hoogte opening", diagonaal: "diagonaal ruimte", vrij: "vrije maat",
};
export const METHODE: Record<Werftest["methode"], string> = { rolmeter: "rolmeter", laser: "laserafstandsmeter", camera: "camera (gsm)", scan: "3D-scan (LiDAR)", gemengd: "gemengd" };

export const nieuweWerftest = (): Werftest => ({ methode: "laser", tolerantie: 10, metingen: [] });

/** Omschrijving van wat gemeten werd (ruimte, muur, opening). */
export function naamMeting(p: Project, m: Controlemeting): string {
  const v = p.verdiepingen.find((x) => x.id === m.verdiepingId);
  if (!v) return m.omschrijving ?? "?";
  const pre = p.verdiepingen.length > 1 ? `${v.naam}: ` : "";
  if (m.soort === "vrij") return pre + (m.omschrijving || "vrije maat");
  if (m.soort === "plafond" || m.soort === "diagonaal") return `${pre}${v.ruimtes.find((r) => r.id === m.refId)?.naam ?? "?"}, ${SOORT_MAAT[m.soort]}`;
  if (m.soort === "muur") {
    const i = v.muren.findIndex((x) => x.id === m.refId);
    const r = v.ruimtes.find((x) => x.muurIds.includes(m.refId ?? ""));
    return `${pre}${r?.naam ?? "muur"}, muur ${i + 1}`;
  }
  const o = v.openingen.find((x) => x.id === m.refId);
  const r = o ? v.ruimtes.find((x) => x.muurIds.includes(o.muurId)) : undefined;
  return `${pre}${r?.naam ?? ""} ${o?.soort ?? "opening"}, ${m.soort === "opening-breedte" ? "breedte" : "hoogte"}`.trim();
}

/** De maat volgens het plan (mm), of null als het element niet (meer) bestaat. */
export function modelWaarde(p: Project, m: Controlemeting): number | null {
  if (m.soort === "vrij") return m.model ?? null;
  const v = p.verdiepingen.find((x) => x.id === m.verdiepingId);
  if (!v) return null;
  switch (m.soort) {
    case "muur": { const mu = v.muren.find((x) => x.id === m.refId); return mu ? Math.round(binnenLengte(mu, v.muren)) : null; }
    case "plafond": return v.ruimtes.find((x) => x.id === m.refId)?.plafondhoogte ?? null;
    case "diagonaal": { const r = v.ruimtes.find((x) => x.id === m.refId); const b = r && binnenmaten(r); return b ? Math.round(Math.hypot(b.breedte, b.diepte)) : null; }
    case "opening-breedte": return v.openingen.find((x) => x.id === m.refId)?.breedte ?? null;
    case "opening-hoogte": return v.openingen.find((x) => x.id === m.refId)?.hoogte ?? null;
  }
}

export interface Resultaat { meting: Controlemeting; naam: string; model: number; verschil: number; binnen: boolean }
export interface Statistiek { n: number; gemiddeld: number; gemiddeldAbs: number; max: number; rms: number; binnenPct: number; binnen: number }

const r1 = (x: number) => Math.round(x * 10) / 10;

export function statistiek(verschillen: number[], tolerantie: number): Statistiek {
  const n = verschillen.length;
  if (!n) return { n: 0, gemiddeld: 0, gemiddeldAbs: 0, max: 0, rms: 0, binnenPct: 0, binnen: 0 };
  const binnen = verschillen.filter((d) => Math.abs(d) <= tolerantie).length;
  return {
    n, binnen,
    gemiddeld: r1(verschillen.reduce((s, d) => s + d, 0) / n),
    gemiddeldAbs: r1(verschillen.reduce((s, d) => s + Math.abs(d), 0) / n),
    max: Math.max(...verschillen.map(Math.abs)),
    rms: r1(Math.sqrt(verschillen.reduce((s, d) => s + d * d, 0) / n)),
    binnenPct: Math.round((binnen / n) * 100),
  };
}

/** Alle controlemetingen met verschil (plan − gemeten) en de statistiek, in totaal en per soort maat. */
export function werftestRapport(p: Project) {
  const t = p.werftest ?? nieuweWerftest();
  const resultaten: Resultaat[] = [];
  const weg: Controlemeting[] = [];
  for (const m of t.metingen) {
    const model = modelWaarde(p, m);
    if (model === null) { weg.push(m); continue; }
    const verschil = Math.round(model - m.gemeten);
    resultaten.push({ meting: m, naam: naamMeting(p, m), model, verschil, binnen: Math.abs(verschil) <= t.tolerantie });
  }
  const perSoort = (Object.keys(SOORT_MAAT) as Controlemeting["soort"][])
    .map((s) => ({ soort: s, stat: statistiek(resultaten.filter((r) => r.meting.soort === s).map((r) => r.verschil), t.tolerantie) }))
    .filter((x) => x.stat.n > 0);
  const totaal = statistiek(resultaten.map((r) => r.verschil), t.tolerantie);
  const opmerkingen: string[] = [];
  if (totaal.n < 10) opmerkingen.push(`Slechts ${totaal.n} controlemeting(en): meet er minstens 10 (verdeeld over muren, hoogtes en openingen) voor een betrouwbaar beeld.`);
  if (totaal.n >= 5 && Math.abs(totaal.gemiddeld) > t.tolerantie / 2) opmerkingen.push(`Het plan is gemiddeld ${Math.abs(totaal.gemiddeld)} mm ${totaal.gemiddeld > 0 ? "groter" : "kleiner"} dan gemeten: mogelijk een vaste afwijking (instrument, meetpunt, plinten).`);
  if (weg.length) opmerkingen.push(`${weg.length} controlemeting(en) verwijzen naar een element dat niet meer in het plan staat en tellen niet mee.`);
  return { werftest: t, resultaten, perSoort, totaal, opmerkingen, weg };
}

export const WERFTEST_DISCLAIMER = "Feitelijk verslag van controlemetingen. Het rapport zegt hoe sterk het plan afwijkt van de gemeten maten; het is geen oordeel over de kwaliteit of de conformiteit van een gebouw of van werken. De vakman bepaalt of de nauwkeurigheid volstaat voor zijn doel (offerte, bestelling, maatwerk).";
