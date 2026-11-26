/**
 * Voordimensionering van een stalen ligger boven een (nieuwe) opening.
 *
 * VOORDIMENSIONERING, NIET VOOR UITVOERING. Bedoeld om met een ingenieur
 * samen te werken: de rekennota toont alle aannames, formules en tussen-
 * resultaten, zodat de ingenieur ze kan controleren en aftekenen.
 * Fundering en de draagkracht van het bestaande metselwerk blijven buiten
 * bereik: de app geeft enkel de oplegreacties als vertrekpunt.
 *
 * Model: vrij opgelegde ligger, gelijkmatig verdeelde last, één of meer
 * profielen naast elkaar die de last gelijk verdelen.
 * Normen (aan te vullen/te controleren door de ingenieur):
 * - NBN EN 1990 + ANB: γG = 1,35, γQ = 1,5, vergelijking 6.10; ψ0 = 0,7 (woning, cat. A), 0,5 (sneeuw).
 * - NBN EN 1993-1-1 + ANB: γM0 = γM1 = 1,0; doorsnedeklasse (tabel 5.2), buiging (6.2.5),
 *   dwarskracht (6.2.6, η = 1), kip (6.3.2.2, algemene methode, Mcr met C1 = 1,127, C2 = 0,454, last op de bovenflens).
 * - Doorbuiging: karakteristieke combinatie ≤ L/500 (ligger die metselwerk draagt; gangbare keuze, geen normwaarde).
 * Niet gecontroleerd: lijfplooi/lijfstuik aan de opleggingen, wringing, brand, vermoeiing, verbindingen.
 */
import { berekendeGrootheden, PROFIELEN, type Profiel } from "./profielen.ts";

export type Staal = "S235" | "S355";
export const FY: Record<Staal, number> = { S235: 235, S355: 355 };
const E = 210000, G_MOD = 81000, GAMMA_M0 = 1.0, GAMMA_M1 = 1.0;

export type LastSoort = "G" | "Q" | "S";
export interface Last {
  omschrijving: string;
  soort: LastSoort; // G = permanent, Q = gebruik (woning), S = sneeuw
  /** Karakteristieke lijnlast op de ligger (kN/m). */
  waarde: number;
}

export interface LiggerInvoer {
  id: string;
  naam: string;
  /** Vrije opening (dagmaat), mm. */
  dagmaat: number;
  /** Opleglengte aan elke kant, mm. */
  oplegging: number;
  staal: Staal;
  /** Aantal profielen naast elkaar (bv. 2 onder een dikke muur). */
  aantal: number;
  /** Kip verhinderd (bovenflens zijdelings gesteund, bv. door metselwerk erop of een vloer). Door de ingenieur te bevestigen. */
  kipVerhinderd: boolean;
  /** Doorbuigingsgrens: L / deze waarde. */
  doorbuiging: number;
  lasten: Last[];
  reeksen?: Array<Profiel["reeks"]>;
  /** Verwijzing naar de muur in het project (optioneel). */
  muurId?: string;
}

export const PSI0: Record<Exclude<LastSoort, "G">, number> = { Q: 0.7, S: 0.5 };

export const LIGGER_DISCLAIMER =
  "VOORDIMENSIONERING — NIET VOOR UITVOERING. Te controleren, aan te vullen en af te tekenen door een ingenieur (stabiliteit). De app vervangt de ingenieur niet. Fundering en draagkracht van het bestaande metselwerk vallen buiten deze berekening.";

// ---------------------------------------------------------------------------
// lasten uit eenvoudige gegevens

export const VOLUMEGEWICHT = [
  { naam: "Metselwerk volle baksteen", gamma: 19 },
  { naam: "Metselwerk snelbouwsteen (geperforeerd)", gamma: 15 },
  { naam: "Kalkzandsteen", gamma: 20 },
  { naam: "Cellenbeton", gamma: 7 },
  { naam: "Gewapend beton", gamma: 25 },
] as const;

/** Muur boven de ligger: γ (kN/m³) × dikte (m) × hoogte (m) → kN/m. Zonder boogwerking (veilige kant). */
export function muurLast(hoogteMm: number, dikteMm: number, gamma: number): number {
  return Math.round(gamma * (dikteMm / 1000) * (hoogteMm / 1000) * 100) / 100;
}

/** Vloer die op de muur rust: invloedsbreedte (m) × last (kN/m²) → kN/m. */
export function vloerLast(invloedsbreedteMm: number, kNm2: number): number {
  return Math.round((invloedsbreedteMm / 1000) * kNm2 * 100) / 100;
}

export const VLOERTYPES = [
  { naam: "Holle welfsels + chape + tegels", g: 4.5 },
  { naam: "Volle betonplaat 15 cm + afwerking", g: 5.0 },
  { naam: "Houten balklaag + plankenvloer", g: 1.0 },
  { naam: "Plat dak (beton, isolatie, dakbedekking)", g: 4.5 },
  { naam: "Hellend dak (hout, pannen), per m² dakvlak", g: 0.9 },
] as const;
/** Gebruikslast woning (NBN EN 1991-1-1 + ANB, cat. A vloeren): 2,0 kN/m². Lichte scheidingswanden: + 0,8 kN/m² (na te kijken). */
export const GEBRUIK_WONING = 2.0;
/** Sneeuw: s = μ1 · sk, sk ≈ 0,5 kN/m² (lage gebieden in België; hoger in de Ardennen, na te kijken), μ1 = 0,8. */
export const SNEEUW = 0.4;

// ---------------------------------------------------------------------------
// berekening

export interface Controle { naam: string; ed: number; rd: number; eenheid: string; uc: number; ok: boolean; uitleg: string }

export interface ProfielResultaat {
  profiel: Profiel;
  klasse: 1 | 2 | 3 | 4;
  controles: Controle[];
  ok: boolean;
  ucMax: number;
}

export interface LiggerResultaat {
  invoer: LiggerInvoer;
  L: number; // mm, overspanning (hart opleggingen)
  gk: number; // kN/m (incl. eigengewicht profiel van de gekozen ligger)
  qd: number; // kN/m, uiterste grenstoestand
  qk: number; // kN/m, karakteristieke combinatie
  combinatie: string;
  resultaten: ProfielResultaat[];
  keuze: ProfielResultaat | null;
  /** Per reeks het lichtste profiel dat voldoet. */
  perReeks: Partial<Record<Profiel["reeks"], ProfielResultaat>>;
  reactie: { gk: number; qk: number; ed: number }; // kN per oplegging (alle profielen samen)
  opleg: { spanning: number; advies: string }; // N/mm² onder de flens(en)
  waarschuwingen: string[];
}

function combinatie(G: number, variabel: Array<{ soort: "Q" | "S"; w: number }>): { qd: number; qk: number; tekst: string } {
  if (!variabel.length) return { qd: 1.35 * G, qk: G, tekst: "1,35·G" };
  let beste = { qd: -1, qk: -1, tekst: "" };
  for (let i = 0; i < variabel.length; i++) {
    const lead = variabel[i]!;
    const rest = variabel.filter((_, j) => j !== i);
    const qd = 1.35 * G + 1.5 * lead.w + rest.reduce((s, x) => s + 1.5 * PSI0[x.soort] * x.w, 0);
    const qk = G + lead.w + rest.reduce((s, x) => s + PSI0[x.soort] * x.w, 0);
    if (qd > beste.qd) beste = { qd, qk, tekst: `1,35·G + 1,5·${lead.soort === "Q" ? "Q" : "S"}${rest.map((x) => ` + 1,5·${PSI0[x.soort].toFixed(1).replace(".", ",")}·${x.soort}`).join("")}` };
  }
  return beste;
}

function klasse(p: Profiel, fy: number): 1 | 2 | 3 | 4 {
  const eps = Math.sqrt(235 / fy);
  const cf = (p.b - p.tw - 2 * p.r) / 2 / p.tf;
  const cw = (p.h - 2 * p.tf - 2 * p.r) / p.tw;
  const kf = cf <= 9 * eps ? 1 : cf <= 10 * eps ? 2 : cf <= 14 * eps ? 3 : 4;
  const kw = cw <= 72 * eps ? 1 : cw <= 83 * eps ? 2 : cw <= 124 * eps ? 3 : 4;
  return Math.max(kf, kw) as 1 | 2 | 3 | 4;
}

/** Kritisch kipmoment (Nmm) voor één profiel, vrij opgelegd, gelijkmatige last op de bovenflens. */
export function mcr(p: Profiel, L: number): number {
  const g = berekendeGrootheden(p);
  const C1 = 1.127, C2 = 0.454, zg = p.h / 2;
  const a = (Math.PI ** 2 * E * g.Iz) / L ** 2;
  return C1 * a * (Math.sqrt(g.Iw / g.Iz + (L ** 2 * G_MOD * g.It) / (Math.PI ** 2 * E * g.Iz) + (C2 * zg) ** 2) - C2 * zg);
}

export function rekenLigger(i: LiggerInvoer): LiggerResultaat {
  const fy = FY[i.staal];
  const n = Math.max(1, Math.round(i.aantal));
  const L = i.dagmaat + i.oplegging; // hart opleggingen
  const Gx = i.lasten.filter((x) => x.soort === "G").reduce((s, x) => s + x.waarde, 0);
  const variabel = i.lasten.filter((x) => x.soort !== "G").map((x) => ({ soort: x.soort as "Q" | "S", w: x.waarde }));
  // variabele lasten van dezelfde soort samen (één actie)
  const samen = (["Q", "S"] as const).map((s) => ({ soort: s, w: variabel.filter((x) => x.soort === s).reduce((t, x) => t + x.w, 0) })).filter((x) => x.w > 0);
  const reeksen = new Set<Profiel["reeks"]>(i.reeksen ?? ["IPE", "HEA", "HEB"]);

  const resultaten: ProfielResultaat[] = PROFIELEN.filter((p) => reeksen.has(p.reeks)).map((p) => {
    const eigen = (n * p.G * 9.81) / 1000; // kN/m
    const c = combinatie(Gx + eigen, samen);
    const g = berekendeGrootheden(p);
    const kl = klasse(p, fy);
    const W = (kl <= 2 ? p.Wpl : p.Wel) * 1000; // mm³
    const MEd = (c.qd * L * L) / 8 / 1e6; // kNm (qd in N/mm = kN/m)
    const VEd = (c.qd * L) / 2 / 1000; // kN
    const McRd = (n * W * fy) / GAMMA_M0 / 1e6;
    const VRd = (n * g.Av * fy) / Math.sqrt(3) / GAMMA_M0 / 1000;
    const controles: Controle[] = [
      { naam: "Buiging", ed: MEd, rd: McRd, eenheid: "kNm", uc: MEd / McRd, ok: MEd <= McRd, uitleg: `M_Ed = q_d·L²/8; M_c,Rd = ${n > 1 ? `${n} × ` : ""}W_${kl <= 2 ? "pl" : "el"}·f_y/γ_M0 (klasse ${kl})` },
      { naam: "Dwarskracht", ed: VEd, rd: VRd, eenheid: "kN", uc: VEd / VRd, ok: VEd <= VRd, uitleg: `V_Ed = q_d·L/2; V_pl,Rd = ${n > 1 ? `${n} × ` : ""}A_v·f_y/(√3·γ_M0), A_v = ${(g.Av / 100).toFixed(1)} cm²` },
    ];
    if (!i.kipVerhinderd) {
      const M1 = mcr(p, L);
      const lam = Math.sqrt((W * fy) / M1);
      const alpha = p.h / p.b <= 2 ? 0.21 : 0.34;
      const phi = 0.5 * (1 + alpha * (lam - 0.2) + lam * lam);
      const chi = Math.min(1, 1 / (phi + Math.sqrt(Math.max(0, phi * phi - lam * lam))));
      const MbRd = (n * chi * W * fy) / GAMMA_M1 / 1e6;
      controles.push({ naam: "Kip", ed: MEd, rd: MbRd, eenheid: "kNm", uc: MEd / MbRd, ok: MEd <= MbRd, uitleg: `M_cr = ${(M1 / 1e6).toFixed(1)} kNm, λ̄_LT = ${lam.toFixed(2)}, kromme ${alpha === 0.21 ? "a" : "b"}, χ_LT = ${chi.toFixed(2)}` });
    }
    const delta = (5 * c.qk * L ** 4) / (384 * E * n * p.Iy * 1e4); // mm
    const grens = L / i.doorbuiging;
    controles.push({ naam: "Doorbuiging", ed: delta, rd: grens, eenheid: "mm", uc: delta / grens, ok: delta <= grens, uitleg: `δ = 5·q_k·L⁴/(384·E·I_y), karakteristieke combinatie; grens L/${i.doorbuiging}` });
    const ok = kl <= 3 && controles.every((x) => x.ok);
    return { profiel: p, klasse: kl, controles, ok, ucMax: Math.max(...controles.map((x) => x.uc)) };
  });

  const goed = resultaten.filter((r) => r.ok);
  const lichtst = (rs: ProfielResultaat[]) => rs.reduce<ProfielResultaat | null>((b, r) => (!b || r.profiel.G < b.profiel.G || (r.profiel.G === b.profiel.G && r.profiel.h < b.profiel.h) ? r : b), null);
  const keuze = lichtst(goed);
  const perReeks: LiggerResultaat["perReeks"] = {};
  for (const reeks of reeksen) { const r = lichtst(goed.filter((x) => x.profiel.reeks === reeks)); if (r) perReeks[reeks] = r; }

  const eigen = keuze ? (n * keuze.profiel.G * 9.81) / 1000 : 0;
  const c = combinatie(Gx + eigen, samen);
  const Qk = samen.reduce((s, x) => s + x.w, 0);
  const reactie = { gk: ((Gx + eigen) * L) / 2000, qk: (Qk * L) / 2000, ed: (c.qd * L) / 2000 };
  const breedte = keuze ? keuze.profiel.b * n : 100 * n;
  const spanning = (reactie.ed * 1000) / (breedte * i.oplegging);
  const advies = spanning > 1.0
    ? `Drukspanning ${spanning.toFixed(2).replace(".", ",")} N/mm² onder de flens: waarschijnlijk is een oplegblok (beton) of spreidplaat nodig. Draagkracht van het metselwerk laten nakijken door de ingenieur.`
    : `Drukspanning ${spanning.toFixed(2).replace(".", ",")} N/mm² onder de flens. Draagkracht van het bestaande metselwerk laten bevestigen door de ingenieur.`;
  const waarschuwingen: string[] = [];
  if (i.oplegging < 150) waarschuwingen.push("Opleglengte kleiner dan 150 mm: gangbaar is minstens 150 à 200 mm (na te kijken).");
  if (!keuze) waarschuwingen.push("Geen enkel profiel uit de tabel voldoet: grotere profielen, meer profielen naast elkaar, een tussensteun of een andere oplossing (ingenieur).");
  if (i.kipVerhinderd) waarschuwingen.push("Aanname: kip verhinderd (bovenflens zijdelings gesteund). Tijdens de uitvoering, vóór het metselwerk erop staat, is dat meestal niet zo: stempelen en laten bevestigen door de ingenieur.");
  if (n > 1) waarschuwingen.push(`${n} profielen naast elkaar: samenwerking verzekeren (bouten, afstandhouders of plaat) en de last gelijk verdelen — door de ingenieur uit te werken.`);
  if (!i.lasten.some((x) => x.soort !== "G")) waarschuwingen.push("Geen variabele last ingegeven: draagt de muur echt geen vloer of dak?");
  return { invoer: i, L, gk: Gx + eigen, qd: c.qd, qk: c.qk, combinatie: c.tekst, resultaten, keuze, perReeks, reactie, opleg: { spanning, advies }, waarschuwingen };
}

/** Standaardinvoer voor een opening. */
export function nieuweLigger(id: string, dagmaat: number, muurDikte = 300): LiggerInvoer {
  return {
    id, naam: "Ligger 1", dagmaat: Math.round(dagmaat), oplegging: 200, staal: "S235", aantal: muurDikte >= 250 ? 2 : 1, kipVerhinderd: true, doorbuiging: 500,
    lasten: [{ omschrijving: `Muur erboven: 2,5 m × ${muurDikte} mm volle baksteen (19 kN/m³)`, soort: "G", waarde: muurLast(2500, muurDikte, 19) }],
  };
}
