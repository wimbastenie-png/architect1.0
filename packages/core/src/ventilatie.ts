/**
 * Ventilatie (vierde net): systeem A/B/C/D, toevoer in droge ruimtes, afvoer
 * in natte ruimtes, doorstroomopeningen, unit en kanalen.
 *
 * Debieten: richtwaarden zoals de app NBN D 50-001 (residentieel) kent,
 * NA TE KIJKEN door de ventilatie-expert (EPB-ventilatieverslag):
 * - droge ruimtes (toevoer): 3,6 m³/h per m², woonkamer min. 75 (mag begrensd tot 150),
 *   slaap-/studeerkamer min. 25 (mag begrensd tot 72);
 * - natte ruimtes (afvoer): keuken, badkamer, washok 3,6 m³/h per m² met min. 50 (begrensd tot 75);
 *   open keuken 75; wc 25.
 * Doorstroomopening: ± 70 cm² per 25 m³/h (richtwaarde; bv. deurspleet).
 * Kanaaldiameter: luchtsnelheid ≤ 3 m/s (hoofdkanaal) of ≤ 2,5 m/s (aftakking).
 * De app geeft nooit een oordeel "conform".
 */
import { vloerNetto } from "./bewerken.ts";
import { ruimteVan, soortDef } from "./installaties.ts";
import type { InstallatiePunt, Project, Punt, Ruimte, Verdieping } from "./schema.ts";

export type Systeem = "A" | "B" | "C" | "D";
export const SYSTEMEN: Array<{ systeem: Systeem; naam: string }> = [
  { systeem: "A", naam: "A — natuurlijke toevoer en afvoer" },
  { systeem: "B", naam: "B — mechanische toevoer, natuurlijke afvoer" },
  { systeem: "C", naam: "C — natuurlijke toevoer (roosters), mechanische afvoer" },
  { systeem: "D", naam: "D — mechanische toevoer en afvoer (balans, warmteterugwinning)" },
];

export type Functie = NonNullable<Ruimte["functie"]>;
export const FUNCTIES: Array<{ functie: Functie; naam: string }> = [
  { functie: "woonkamer", naam: "Woonkamer" }, { functie: "keuken", naam: "Keuken (gesloten)" }, { functie: "open-keuken", naam: "Open keuken" },
  { functie: "slaapkamer", naam: "Slaapkamer" }, { functie: "studeerkamer", naam: "Studeer-/speelkamer" }, { functie: "badkamer", naam: "Badkamer" },
  { functie: "wc", naam: "Wc" }, { functie: "washok", naam: "Washok" }, { functie: "berging", naam: "Berging" }, { functie: "gang", naam: "Gang, hal, overloop" }, { functie: "andere", naam: "Andere" },
];

export const VENTILATIE_DISCLAIMER =
  "Voorstel ter voorbereiding van het ventilatieontwerp. Debieten volgens richtwaarden uit NBN D 50-001, na te kijken door de ventilatie-expert (EPB-ventilatieverslag). De app geeft nooit een oordeel 'conform'.";

/** Functie uit de naam afleiden (bv. "Leefruimte" → woonkamer). */
export function functieVan(r: Ruimte): Functie {
  if (r.functie) return r.functie;
  const n = r.naam.toLowerCase();
  if (/open keuken/.test(n)) return "open-keuken";
  if (/keuken/.test(n)) return "keuken";
  if (/bad|douche/.test(n)) return "badkamer";
  if (/\bwc\b|toilet/.test(n)) return "wc";
  if (/was(plaats|hok|ruimte)|berging.*was/.test(n)) return "washok";
  if (/slaap|kamer \d|kinderkamer/.test(n)) return "slaapkamer";
  if (/bureau|studeer|speel/.test(n)) return "studeerkamer";
  if (/leef|woon|living|zit|eet/.test(n)) return "woonkamer";
  if (/gang|hal|overloop|inkom/.test(n)) return "gang";
  if (/berging|zolder|kelder|garage/.test(n)) return "berging";
  return "andere";
}

export interface RuimteDebiet {
  verdieping: string;
  ruimte: Ruimte;
  functie: Functie;
  oppervlakte: number; // m²
  toevoer: number; // m³/h (droge ruimtes)
  afvoer: number; // m³/h (natte ruimtes)
  /** Doorstroomopening nodig (cm²), naar of van de verkeersruimte. */
  doorstroom: number;
  punten: InstallatiePunt[];
}

const klem = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export function debietVan(f: Functie, m2: number): { toevoer: number; afvoer: number } {
  const q = 3.6 * m2;
  switch (f) {
    case "woonkamer": return { toevoer: Math.round(klem(q, 75, 150)), afvoer: 0 };
    case "slaapkamer": case "studeerkamer": return { toevoer: Math.round(klem(q, 25, 72)), afvoer: 0 };
    case "open-keuken": return { toevoer: 0, afvoer: 75 };
    case "keuken": case "badkamer": case "washok": return { toevoer: 0, afvoer: Math.round(klem(q, 50, 75)) };
    case "wc": return { toevoer: 0, afvoer: 25 };
    default: return { toevoer: 0, afvoer: 0 };
  }
}

export function systeemVan(p: Project): Systeem { return p.ventilatie?.systeem ?? "C"; }

export function ventilatieDebieten(p: Project): RuimteDebiet[] {
  const uit: RuimteDebiet[] = [];
  for (const v of p.verdiepingen) {
    for (const r of v.ruimtes) {
      const f = functieVan(r);
      const m2 = vloerNetto(r, v) / 1e6;
      const d = debietVan(f, m2);
      const punten = v.installaties.filter((x) => x.net === "ventilatie" && ruimteVan(v, x.positie)?.id === r.id);
      uit.push({ verdieping: v.naam, ruimte: r, functie: f, oppervlakte: Math.round(m2 * 100) / 100, ...d, doorstroom: Math.round(((d.toevoer + d.afvoer) / 25) * 70), punten });
    }
  }
  return uit;
}

export const DIAMETERS = [80, 100, 125, 160, 180, 200, 250];
/** Kleinste standaarddiameter (mm) voor een debiet (m³/h) bij een luchtsnelheid (m/s). */
export function diameter(q: number, v = 2.5): number {
  const d = Math.sqrt((4 * (q / 3600)) / (Math.PI * v)) * 1000;
  return DIAMETERS.find((x) => x >= d) ?? 315;
}

export interface Kanaal { soort: "toevoer" | "afvoer"; verdiepingId: string; naar: string; pad: Punt[]; lengte: number; diameter: number; debiet: number }

const haaks = (a: Punt, b: Punt): Punt[] => (a.x === b.x || a.y === b.y ? [a, b] : [a, { x: b.x, y: a.y }, b]);

/** Kanalen: van de unit haaks naar elk mechanisch ventiel (A: geen kanalen behalve NAO). */
export function ventilatieKanalen(p: Project): Kanaal[] {
  const sys = systeemVan(p);
  const unit = p.verdiepingen.flatMap((v) => v.installaties.map((x) => ({ v, x }))).find((y) => y.x.soort === "vent-unit");
  if (!unit) return [];
  const debieten = ventilatieDebieten(p);
  const uit: Kanaal[] = [];
  for (const v of p.verdiepingen) {
    for (const x of v.installaties) {
      const soort = x.soort === "vent-toevoer" ? "toevoer" : x.soort === "vent-afvoer" ? "afvoer" : null;
      if (!soort) continue;
      if ((soort === "toevoer" && (sys === "A" || sys === "C")) || (soort === "afvoer" && (sys === "A" || sys === "B"))) continue;
      const r = ruimteVan(v, x.positie);
      const d = debieten.find((y) => y.ruimte.id === r?.id);
      const n = d ? d.punten.filter((y) => y.soort === x.soort).length || 1 : 1;
      const q = d ? (soort === "toevoer" ? d.toevoer : d.afvoer) / n : 30;
      const zelfde = unit.v.id === v.id;
      const pad = zelfde ? haaks(unit.x.positie, x.positie) : [x.positie];
      const lengte = pad.slice(1).reduce((s, q2, i) => s + Math.abs(q2.x - pad[i]!.x) + Math.abs(q2.y - pad[i]!.y), 0) + (zelfde ? 0 : Math.abs(v.peil - unit.v.peil));
      uit.push({ soort, verdiepingId: v.id, naar: x.id, pad, lengte: Math.round(lengte), diameter: diameter(Math.max(q, 1)), debiet: Math.round(q) });
    }
  }
  return uit;
}

export interface VentilatieAandachtspunt { ernst: "let op" | "info"; tekst: string; ruimteId?: string }

export function ventilatieAandachtspunten(p: Project): VentilatieAandachtspunt[] {
  const sys = systeemVan(p);
  const deb = ventilatieDebieten(p);
  const uit: VentilatieAandachtspunt[] = [];
  const telt = (d: RuimteDebiet, soort: string) => d.punten.filter((x) => x.soort === soort).length;
  for (const d of deb) {
    const wie = `${d.ruimte.naam} (${d.verdieping})`;
    if (d.toevoer) {
      const nodig = sys === "A" || sys === "C" ? "vent-rooster" : "vent-toevoer";
      if (!telt(d, nodig)) uit.push({ ernst: "let op", ruimteId: d.ruimte.id, tekst: `${wie}: toevoer van ${d.toevoer} m³/h nodig — plaats een ${soortDef(nodig)!.naam.toLowerCase()}.` });
    }
    if (d.afvoer) {
      const nodig = sys === "C" || sys === "D" ? "vent-afvoer" : "vent-natuurlijk";
      if (!telt(d, nodig)) uit.push({ ernst: "let op", ruimteId: d.ruimte.id, tekst: `${wie}: afvoer van ${d.afvoer} m³/h nodig — plaats een ${soortDef(nodig)!.naam.toLowerCase()}.` });
    }
    if (d.doorstroom) uit.push({ ernst: "info", ruimteId: d.ruimte.id, tekst: `${wie}: doorstroomopening ± ${d.doorstroom} cm² (bv. deurspleet van ${Math.ceil(d.doorstroom / 83)} cm onder een deur van 83 cm).` });
    if ((d.functie === "badkamer" || d.functie === "wc" || d.functie === "keuken") && telt(d, "vent-toevoer")) uit.push({ ernst: "let op", ruimteId: d.ruimte.id, tekst: `${wie}: natte ruimte met een toevoerventiel — gewoonlijk alleen afvoer.` });
  }
  const toe = deb.reduce((s, d) => s + d.toevoer, 0), af = deb.reduce((s, d) => s + d.afvoer, 0);
  const heeftUnit = p.verdiepingen.some((v) => v.installaties.some((x) => x.soort === "vent-unit"));
  if (sys !== "A" && !heeftUnit && (toe || af)) uit.push({ ernst: "let op", tekst: `Systeem ${sys}: plaats de ventilatie-unit op het plan (kanalen worden vanaf de unit getekend).` });
  if (sys === "D") uit.push({ ernst: "info", tekst: `Systeem D: totale toevoer ${toe} m³/h, afvoer ${af} m³/h. De unit wordt in balans geregeld op het grootste van beide (${Math.max(toe, af)} m³/h).` });
  uit.push({ ernst: "info", tekst: "Kanalen zijn een schets (haaks van de unit naar elk ventiel). Tracé, geluiddempers, isolatie van kanalen buiten het beschermd volume en de inregeling legt de ventilatie-expert vast." });
  return uit;
}

export interface VentMateriaal { omschrijving: string; eenheid: "st" | "m"; hoeveelheid: number }

export function ventilatieMateriaal(p: Project): VentMateriaal[] {
  const uit: VentMateriaal[] = [];
  const tel = new Map<string, number>();
  for (const v of p.verdiepingen) for (const x of v.installaties) if (x.net === "ventilatie") tel.set(x.soort, (tel.get(x.soort) ?? 0) + 1);
  for (const [soort, n] of tel) uit.push({ omschrijving: soortDef(soort)?.naam ?? soort, eenheid: "st", hoeveelheid: n });
  const k = ventilatieKanalen(p);
  const perD = new Map<number, number>();
  for (const x of k) perD.set(x.diameter, (perD.get(x.diameter) ?? 0) + x.lengte);
  for (const [d, mm] of [...perD].sort((a, b) => a[0] - b[0])) uit.push({ omschrijving: `Kanaal Ø ${d} mm (+10 %)`, eenheid: "m", hoeveelheid: Math.ceil((mm * 1.1) / 1000) });
  if (k.length) uit.push({ omschrijving: "Bochten / koppelstukken (schatting)", eenheid: "st", hoeveelheid: k.reduce((s, x) => s + Math.max(1, x.pad.length - 1), 0) });
  const sys = systeemVan(p);
  if ((sys === "C" || sys === "D") && tel.get("vent-unit")) uit.push({ omschrijving: "Muur- of dakdoorvoer (uitblaas" + (sys === "D" ? " en aanzuig" : "") + ")", eenheid: "st", hoeveelheid: sys === "D" ? 2 : 1 });
  if (sys === "D" && tel.get("vent-unit")) uit.push({ omschrijving: "Geluiddemper", eenheid: "st", hoeveelheid: 2 });
  return uit;
}

export const VENT_KLEUR = { toevoer: "#0891b2", afvoer: "#a16207" } as const;

/** Kanalen als SVG (in plancoördinaten via t). */
export function ventilatieSVG(p: Project, v: Verdieping, t: (q: Punt) => { x: number; y: number }): string[] {
  const el: string[] = [];
  for (const k of ventilatieKanalen(p)) {
    if (k.verdiepingId !== v.id || k.pad.length < 2) continue;
    const pts = k.pad.map((q) => { const r = t(q); return `${r.x.toFixed(0)},${r.y.toFixed(0)}`; }).join(" ");
    el.push(`<polyline points="${pts}" fill="none" stroke="${VENT_KLEUR[k.soort]}" stroke-width="${Math.max(30, k.diameter / 3).toFixed(0)}" stroke-opacity="0.55" stroke-linejoin="round" pointer-events="none"/>`);
    const m = t(k.pad[Math.floor(k.pad.length / 2)]!);
    el.push(`<text x="${m.x.toFixed(0)}" y="${(m.y - 60).toFixed(0)}" font-size="110" fill="${VENT_KLEUR[k.soort]}" text-anchor="middle" paint-order="stroke" stroke="#fff" stroke-width="30" pointer-events="none">Ø${k.diameter}</text>`);
  }
  return el;
}
