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
import { los } from "./statica.ts";
import type { Muur, Project, Verdieping } from "./schema.ts";

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
  /** Puntlasten (karakteristiek, kN), a = afstand vanaf het linkse steunpunt (mm). */
  puntlasten?: Array<{ omschrijving: string; soort: LastSoort; waarde: number; a: number }>;
  /** Doorgaande ligger: dagmaat van de tweede opening (mm); de tussensteun heeft dezelfde opleglengte. */
  tweede?: number;
  /** Rekenwaarde van de druksterkte van het metselwerk onder de oplegging (N/mm²), door de ingenieur te bepalen. */
  metselwerkFd?: number;
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
  L: number; // mm, totale lengte tussen de buitenste steunpunten (hart opleggingen)
  spans: number[]; // overspanningen (mm)
  reacties: number[]; // R_d per steunpunt (kN)
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

type Cat = "G" | "Q" | "S";
interface Set { f: Record<Cat, number>; fk: Record<Cat, number>; tekst: string }

/** Combinaties: één leidende variabele actie, de andere met ψ0 (UGT 6.10, BGT karakteristiek). */
function combinaties(cats: Cat[]): Set[] {
  const vars = cats.filter((c) => c !== "G") as Array<"Q" | "S">;
  if (!vars.length) return [{ f: { G: 1.35, Q: 0, S: 0 }, fk: { G: 1, Q: 0, S: 0 }, tekst: "1,35·G" }];
  return vars.map((lead) => {
    const f = { G: 1.35, Q: 0, S: 0 }, fk = { G: 1, Q: 0, S: 0 };
    for (const v of vars) { f[v] = v === lead ? 1.5 : 1.5 * PSI0[v]; fk[v] = v === lead ? 1 : PSI0[v]; }
    const rest = vars.filter((v) => v !== lead);
    return { f, fk, tekst: `1,35·G + 1,5·${lead}${rest.map((x) => ` + 1,5·${PSI0[x].toFixed(1).replace(".", ",")}·${x}`).join("")}` };
  });
}

/** Weerstand tegen dwarskrachten op het lijf (lijfstuik en lijfplooi samen), NBN EN 1993-1-5 §6, zonder verstijvers. N per profiel. */
export function lijfWeerstand(p: Profiel, fy: number, ss: number, eind: boolean): { FRd: number; uitleg: string } {
  const hw = p.h - 2 * p.tf, tw = p.tw, tf = p.tf;
  const s = Math.min(ss, hw);
  const kF = eind ? Math.min(6, 2 + (6 * s) / hw) : 6;
  const Fcr = (0.9 * kF * E * tw ** 3) / hw;
  const m1 = p.b / tw;
  const ly = (m2: number) => {
    if (!eind) return s + 2 * tf * (1 + Math.sqrt(m1 + m2));
    const le = Math.min((kF * E * tw * tw) / (2 * fy * hw), s);
    return Math.min(le + tf * Math.sqrt(m1 / 2 + (le / tf) ** 2 + m2), le + tf * Math.sqrt(m1 + m2));
  };
  let m2 = 0.02 * (hw / tf) ** 2;
  let l = ly(m2), lam = Math.sqrt((l * tw * fy) / Fcr);
  if (lam <= 0.5) { m2 = 0; l = ly(0); lam = Math.sqrt((l * tw * fy) / Fcr); }
  const chi = Math.min(1, 0.5 / lam);
  const FRd = (fy * chi * l * tw) / GAMMA_M1;
  return { FRd, uitleg: `${eind ? "eindsteunpunt (type c)" : "tussensteunpunt (type a)"}: s_s = ${Math.round(s)} mm, k_F = ${kF.toFixed(2)}, l_y = ${Math.round(l)} mm, λ̄_F = ${lam.toFixed(2)}, χ_F = ${chi.toFixed(2)}` };
}

export function rekenLigger(i: LiggerInvoer): LiggerResultaat {
  const fy = FY[i.staal];
  const n = Math.max(1, Math.round(i.aantal));
  const spans = [i.dagmaat + i.oplegging, ...(i.tweede ? [i.tweede + i.oplegging] : [])];
  const L = spans.reduce((s, x) => s + x, 0);
  const lijn = (c: Cat) => i.lasten.filter((x) => x.soort === c).reduce((s, x) => s + x.waarde, 0);
  const punten = (i.puntlasten ?? []).map((x) => ({ ...x, a: Math.max(0, Math.min(L, x.a)) }));
  const cats = (["G", "Q", "S"] as Cat[]).filter((c) => c === "G" || lijn(c) > 0 || punten.some((x) => x.soort === c));
  const sets = combinaties(cats);
  const patronen: number[][] = spans.length === 2 ? [[1, 1], [1, 0], [0, 1]] : [[1]];
  const reeksen = new Set<Profiel["reeks"]>(i.reeksen ?? ["IPE", "HEA", "HEB"]);
  const Gx = lijn("G");

  const omhullende = (eigen: number, EI?: number) => {
    let Mmax = 0, Mmin = 0, Vmax = 0, R = spans.map(() => 0) as number[], R0 = [0, 0, 0], delta = spans.map(() => 0) as number[], qd = 0, qk = 0, tekst = sets[0]!.tekst;
    for (const set of sets) for (const pat of patronen) {
      const q = (fac: Record<Cat, number>) => spans.map((_, s) => fac.G * (Gx + eigen) + (fac.Q * lijn("Q") + fac.S * lijn("S")) * pat[s]!);
      const pts = (fac: Record<Cat, number>) => punten.map((x) => ({ a: x.a, P: fac[x.soort] * x.waarde }));
      const u = los(spans, { q: q(set.f), punten: pts(set.f) });
      if (Math.max(u.Mmax, -u.Mmin) > Math.max(Mmax, -Mmin)) tekst = set.tekst;
      Mmax = Math.max(Mmax, u.Mmax); Mmin = Math.min(Mmin, u.Mmin); Vmax = Math.max(Vmax, u.Vmax);
      R = R.length === u.R.length ? R.map((x, k) => Math.max(x, u.R[k]!)) : u.R;
      qd = Math.max(qd, ...q(set.f));
      if (EI) {
        const k = los(spans, { q: q(set.fk), punten: pts(set.fk) }, EI);
        delta = delta.map((x, s) => Math.max(x, k.delta[s]!));
        qk = Math.max(qk, ...q(set.fk));
      }
      // karakteristieke reacties (G en Q apart) voor de fundering
      const g = los(spans, { q: spans.map(() => Gx + eigen), punten: punten.filter((x) => x.soort === "G").map((x) => ({ a: x.a, P: x.waarde })) });
      const v = los(spans, { q: spans.map(() => lijn("Q") + lijn("S")), punten: punten.filter((x) => x.soort !== "G").map((x) => ({ a: x.a, P: x.waarde })) });
      R0 = [Math.max(...g.R.map((x, k) => (k === 0 || k === g.R.length - 1 ? x : 0))), Math.max(...v.R.map((x, k) => (k === 0 || k === v.R.length - 1 ? x : 0))), spans.length === 2 ? Math.max(g.R[1]! + v.R[1]!, R0[2]!) : 0];
    }
    return { Mmax, Mmin, Vmax, R, delta, qd, qk, tekst, Rgk: R0[0]!, Rqk: R0[1]! };
  };

  const resultaten: ProfielResultaat[] = PROFIELEN.filter((p) => reeksen.has(p.reeks)).map((p) => {
    const eigen = (n * p.G * 9.81) / 1000; // kN/m
    const g = berekendeGrootheden(p);
    const kl = klasse(p, fy);
    const W = (kl <= 2 ? p.Wpl : p.Wel) * 1000; // mm³
    const k = omhullende(eigen, E * n * p.Iy * 1e4);
    const MEd = Math.max(k.Mmax, -k.Mmin), VEd = k.Vmax;
    const McRd = (n * W * fy) / GAMMA_M0 / 1e6;
    const VRd = (n * g.Av * fy) / Math.sqrt(3) / GAMMA_M0 / 1000;
    const schema = spans.length === 2 ? "doorgaande ligger op 3 steunpunten (driemomentenvergelijking)" : punten.length ? "vrij opgelegd met puntlasten" : "M_Ed = q_d·L²/8";
    const controles: Controle[] = [
      { naam: "Buiging", ed: MEd, rd: McRd, eenheid: "kNm", uc: MEd / McRd, ok: MEd <= McRd, uitleg: `${schema}${spans.length === 2 ? `: veld ${k.Mmax.toFixed(1)}, steunpunt ${k.Mmin.toFixed(1)} kNm` : ""}; M_c,Rd = ${n > 1 ? `${n} × ` : ""}W_${kl <= 2 ? "pl" : "el"}·f_y/γ_M0 (klasse ${kl})` },
      { naam: "Dwarskracht", ed: VEd, rd: VRd, eenheid: "kN", uc: VEd / VRd, ok: VEd <= VRd, uitleg: `V_pl,Rd = ${n > 1 ? `${n} × ` : ""}A_v·f_y/(√3·γ_M0), A_v = ${(g.Av / 100).toFixed(1)} cm²` },
    ];
    if (!i.kipVerhinderd) {
      const M1 = mcr(p, Math.max(...spans));
      const lam = Math.sqrt((W * fy) / M1);
      const alpha = p.h / p.b <= 2 ? 0.21 : 0.34;
      const phi = 0.5 * (1 + alpha * (lam - 0.2) + lam * lam);
      const chi = Math.min(1, 1 / (phi + Math.sqrt(Math.max(0, phi * phi - lam * lam))));
      const MbRd = (n * chi * W * fy) / GAMMA_M1 / 1e6;
      controles.push({ naam: "Kip", ed: MEd, rd: MbRd, eenheid: "kNm", uc: MEd / MbRd, ok: MEd <= MbRd, uitleg: `M_cr = ${(M1 / 1e6).toFixed(1)} kNm (grootste overspanning, C1 = 1,127), λ̄_LT = ${lam.toFixed(2)}, kromme ${alpha === 0.21 ? "a" : "b"}, χ_LT = ${chi.toFixed(2)}` });
    }
    const delta = Math.max(...k.delta.map((d, s) => d / (spans[s]! / i.doorbuiging)));
    const sGov = k.delta.map((d, s) => d / (spans[s]! / i.doorbuiging)).reduce((b2, x, s, a) => (x > a[b2]! ? s : b2), 0);
    controles.push({ naam: "Doorbuiging", ed: k.delta[sGov]!, rd: spans[sGov]! / i.doorbuiging, eenheid: "mm", uc: delta, ok: delta <= 1, uitleg: `numeriek uit de momentenlijn, karakteristieke combinatie; grens L/${i.doorbuiging}${spans.length === 2 ? ` (overspanning ${sGov + 1})` : ""}` });
    // lijfstuik/lijfplooi aan de steunpunten
    const eindR = Math.max(k.R[0]!, k.R[k.R.length - 1]!) / n;
    const lw = lijfWeerstand(p, fy, i.oplegging, true);
    controles.push({ naam: "Lijf (oplegging)", ed: eindR, rd: lw.FRd / 1000, eenheid: "kN", uc: (eindR * 1000) / lw.FRd, ok: eindR * 1000 <= lw.FRd, uitleg: `per profiel; ${lw.uitleg}` });
    if (spans.length === 2) {
      const mid = k.R[1]! / n, lm = lijfWeerstand(p, fy, i.oplegging, false);
      controles.push({ naam: "Lijf (tussensteun)", ed: mid, rd: lm.FRd / 1000, eenheid: "kN", uc: (mid * 1000) / lm.FRd, ok: mid * 1000 <= lm.FRd, uitleg: `per profiel; ${lm.uitleg}` });
    }
    if (i.metselwerkFd) {
      const R = Math.max(...k.R);
      const sp = (R * 1000) / (n * p.b * i.oplegging);
      controles.push({ naam: "Oplegging metselwerk", ed: sp, rd: i.metselwerkFd, eenheid: "N/mm²", uc: sp / i.metselwerkFd, ok: sp <= i.metselwerkFd, uitleg: `σ = R_d / (n · b · opleglengte); f_d = ${String(i.metselwerkFd).replace(".", ",")} N/mm² (ingegeven). Nodig oplegvlak ≥ ${Math.ceil((R * 1000) / i.metselwerkFd / 100)} cm²` });
    }
    const ok = kl <= 3 && controles.every((x) => x.ok);
    return { profiel: p, klasse: kl, controles, ok, ucMax: Math.max(...controles.map((x) => x.uc)) };
  });

  const goed = resultaten.filter((r) => r.ok);
  const lichtst = (rs: ProfielResultaat[]) => rs.reduce<ProfielResultaat | null>((b, r) => (!b || r.profiel.G < b.profiel.G || (r.profiel.G === b.profiel.G && r.profiel.h < b.profiel.h) ? r : b), null);
  const keuze = lichtst(goed);
  const perReeks: LiggerResultaat["perReeks"] = {};
  for (const reeks of reeksen) { const r = lichtst(goed.filter((x) => x.profiel.reeks === reeks)); if (r) perReeks[reeks] = r; }

  const eigen = keuze ? (n * keuze.profiel.G * 9.81) / 1000 : 0;
  const k = omhullende(eigen);
  const c = combinatie(Gx + eigen, (["Q", "S"] as const).map((s2) => ({ soort: s2, w: lijn(s2) })).filter((x) => x.w > 0));
  const reactie = { gk: k.Rgk, qk: k.Rqk, ed: Math.max(k.R[0]!, k.R[k.R.length - 1]!) };
  const breedte = keuze ? keuze.profiel.b * n : 100 * n;
  const spanning = (Math.max(...k.R) * 1000) / (breedte * i.oplegging);
  const fd = i.metselwerkFd;
  const advies = fd
    ? spanning > fd
      ? `Drukspanning ${spanning.toFixed(2).replace(".", ",")} N/mm² > f_d ${String(fd).replace(".", ",")} N/mm²: oplegblok (beton) of spreidplaat nodig, oplegvlak ≥ ${Math.ceil((Math.max(...k.R) * 1000) / fd / 100)} cm². Laat de ingenieur het blok dimensioneren.`
      : `Drukspanning ${spanning.toFixed(2).replace(".", ",")} N/mm² ≤ f_d ${String(fd).replace(".", ",")} N/mm² (ingegeven). Metselwerksterkte te bevestigen door de ingenieur.`
    : spanning > 1.0
      ? `Drukspanning ${spanning.toFixed(2).replace(".", ",")} N/mm² onder de flens: waarschijnlijk is een oplegblok (beton) of spreidplaat nodig. Geef de metselwerksterkte f_d in voor een controle; laat de ingenieur ze bepalen.`
      : `Drukspanning ${spanning.toFixed(2).replace(".", ",")} N/mm² onder de flens. Draagkracht van het bestaande metselwerk laten bevestigen door de ingenieur.`;
  const waarschuwingen: string[] = [];
  if (i.oplegging < 150) waarschuwingen.push("Opleglengte kleiner dan 150 mm: gangbaar is minstens 150 à 200 mm (na te kijken).");
  if (!keuze) waarschuwingen.push("Geen enkel profiel uit de tabel voldoet: grotere profielen, meer profielen naast elkaar, een tussensteun of een andere oplossing (ingenieur).");
  if (i.kipVerhinderd) waarschuwingen.push("Aanname: kip verhinderd (bovenflens zijdelings gesteund). Tijdens de uitvoering, vóór het metselwerk erop staat, is dat meestal niet zo: stempelen en laten bevestigen door de ingenieur.");
  if (!i.kipVerhinderd && spans.length === 2) waarschuwingen.push("Kip bij een doorgaande ligger: vereenvoudigd (grootste overspanning, C1 = 1,127); bij het steunpunt staat de onderflens onder druk — ingenieur.");
  if (n > 1) waarschuwingen.push(`${n} profielen naast elkaar: samenwerking verzekeren (bouten, afstandhouders of plaat) en de last gelijk verdelen — door de ingenieur uit te werken.`);
  if (!i.lasten.some((x) => x.soort !== "G") && !punten.some((x) => x.soort !== "G")) waarschuwingen.push("Geen variabele last ingegeven: draagt de muur echt geen vloer of dak?");
  if (spans.length === 2) waarschuwingen.push(`Tussensteun: reactie R_d = ${k.R[1]!.toFixed(1).replace(".", ",")} kN op de kolom of muur in het midden.`);
  return { invoer: i, L, spans, gk: Gx + eigen, qd: k.qd || c.qd, qk: c.qk, combinatie: k.tekst, resultaten, keuze, perReeks, reactie, reacties: k.R, opleg: { spanning, advies }, waarschuwingen };
}

/** Standaardinvoer voor een opening. */
export function nieuweLigger(id: string, dagmaat: number, muurDikte = 300): LiggerInvoer {
  return {
    id, naam: "Ligger 1", dagmaat: Math.round(dagmaat), oplegging: 200, staal: "S235", aantal: muurDikte >= 250 ? 2 : 1, kipVerhinderd: true, doorbuiging: 500,
    lasten: [{ omschrijving: `Muur erboven: 2,5 m × ${muurDikte} mm volle baksteen (19 kN/m³)`, soort: "G", waarde: muurLast(2500, muurDikte, 19) }],
  };
}

// ---------------------------------------------------------------------------
// lastendaling uit het model

/**
 * Lasten op een ligger in muur `muurId`, uit het model berekend:
 * - de muur boven de opening op dezelfde verdieping (en de muren die er op de
 *   verdiepingen erboven recht boven staan), volle baksteen 19 kN/m³ tenzij anders;
 * - per verdieping erboven een vloer, en bovenaan het dak, met als
 *   invloedsbreedte de helft van de diepte van de aangrenzende ruimtes.
 * AANNAME (door de ingenieur te bevestigen): de vloeren dragen af op deze muur
 * (overspanning loodrecht op de muur). Het model kent de draagrichting niet.
 */
export function lastenUitModel(p: Project, muurId: string, o: { gamma?: number; vloerG?: number; vloerQ?: number; dakG?: number; sneeuw?: number; openingId?: string } = {}): Last[] {
  const gamma = o.gamma ?? 19, vg = o.vloerG ?? 4.5, vq = o.vloerQ ?? GEBRUIK_WONING, dg = o.dakG ?? 0.9, sn = o.sneeuw ?? SNEEUW;
  const v = p.verdiepingen.find((x) => x.muren.some((m) => m.id === muurId));
  if (!v) return [];
  const m = v.muren.find((x) => x.id === muurId)!;
  const L = Math.hypot(m.eind.x - m.start.x, m.eind.y - m.start.y);
  const u = { x: (m.eind.x - m.start.x) / L, y: (m.eind.y - m.start.y) / L }, nrm = { x: -u.y, y: u.x };
  const uit: Last[] = [];
  // muur boven de opening, zelfde verdieping
  const o1 = o.openingId ? v.openingen.find((x) => x.id === o.openingId) : v.openingen.filter((x) => x.muurId === m.id).sort((a, b) => b.breedte - a.breedte)[0];
  if (m.toestand !== "afbreken" && o1) {
    const h = Math.max(0, m.hoogte - (o1.borstwering + o1.hoogte));
    if (h > 0) uit.push({ omschrijving: `Muur boven de opening (${v.naam}): ${h} mm × ${m.dikte} mm × ${gamma} kN/m³ (uit model)`, soort: "G", waarde: muurLast(h, m.dikte, gamma) });
  }
  // invloedsbreedte: helft van de diepte (loodrecht op de muur) van de aangrenzende ruimtes
  const invloed = (vv: Verdieping, mm: Muur) => vv.ruimtes.filter((r) => r.muurIds.includes(mm.id)).reduce((s, r) => {
    const t = r.contour.map((q) => q.x * nrm.x + q.y * nrm.y);
    return s + (Math.max(...t) - Math.min(...t)) / 2;
  }, 0);
  const boven = p.verdiepingen.filter((x) => x.peil > v.peil).sort((a, b) => a.peil - b.peil);
  const opLijn = (mm: Muur) => {
    const L2 = Math.hypot(mm.eind.x - mm.start.x, mm.eind.y - mm.start.y);
    const u2 = { x: (mm.eind.x - mm.start.x) / L2, y: (mm.eind.y - mm.start.y) / L2 };
    if (Math.abs(u.x * u2.y - u.y * u2.x) > 0.05) return false;
    const afst = Math.abs((mm.start.x - m.start.x) * nrm.x + (mm.start.y - m.start.y) * nrm.y);
    if (afst > 100) return false;
    const t1 = (mm.start.x - m.start.x) * u.x + (mm.start.y - m.start.y) * u.y, t2 = (mm.eind.x - m.start.x) * u.x + (mm.eind.y - m.start.y) * u.y;
    return Math.max(t1, t2) > 100 && Math.min(t1, t2) < L - 100;
  };
  // vloer boven deze verdieping (het plafond van v) draagt op m
  let breedte = invloed(v, m);
  for (const [k, w] of boven.entries()) {
    if (breedte > 0) {
      uit.push({ omschrijving: `Vloer boven ${k === 0 ? v.naam : boven[k - 1]!.naam}: ${String(vg).replace(".", ",")} kN/m² × ${(breedte / 1000).toFixed(2).replace(".", ",")} m (uit model; aanname: vloer draagt af op deze muur)`, soort: "G", waarde: vloerLast(breedte, vg) });
      uit.push({ omschrijving: `Gebruik ${String(vq).replace(".", ",")} kN/m² × ${(breedte / 1000).toFixed(2).replace(".", ",")} m (${w.naam}, uit model)`, soort: "Q", waarde: vloerLast(breedte, vq) });
    }
    const erboven = w.muren.filter((x) => x.toestand !== "afbreken" && opLijn(x));
    if (!erboven.length) { breedte = 0; break; }
    const mb = erboven.sort((a, b) => b.dikte - a.dikte)[0]!;
    uit.push({ omschrijving: `Muur erboven (${w.naam}): ${mb.hoogte} mm × ${mb.dikte} mm × ${gamma} kN/m³ (uit model)`, soort: "G", waarde: muurLast(mb.hoogte, mb.dikte, gamma) });
    breedte = invloed(w, mb);
  }
  if (breedte > 0) {
    uit.push({ omschrijving: `Dak: ${String(dg).replace(".", ",")} kN/m² × ${(breedte / 1000).toFixed(2).replace(".", ",")} m (uit model; aanname: dak draagt af op deze muur)`, soort: "G", waarde: vloerLast(breedte, dg) });
    uit.push({ omschrijving: `Sneeuw ${String(sn).replace(".", ",")} kN/m² × ${(breedte / 1000).toFixed(2).replace(".", ",")} m`, soort: "S", waarde: vloerLast(breedte, sn) });
  }
  return uit;
}

// ---------------------------------------------------------------------------
// kolommen: eenvoudige knikcontrole (NBN EN 1993-1-1 §6.3.1)

export type KolomInvoer = Project["kolommen"][number];

export interface KolomResultaat {
  invoer: KolomInvoer;
  NEd: number; // kN
  resultaten: Array<{ profiel: Profiel; NbRd: number; NcRd: number; uc: number; ok: boolean; uitleg: string; klasse: number }>;
  keuze: KolomResultaat["resultaten"][number] | null;
  waarschuwingen: string[];
}

/** Knikkromme volgens tabel 6.2 (gewalste I/H, t_f ≤ 40 mm). */
function kromme(p: Profiel, as: "y" | "z", fy: number): number {
  const hb = p.h / p.b;
  if (hb > 1.2) return as === "y" ? (fy >= 460 ? 0.13 : 0.21) : 0.34;
  return as === "y" ? 0.34 : 0.49;
}

export function rekenKolom(k: KolomInvoer, p?: Project): KolomResultaat {
  const fy = FY[k.staal];
  let gk = k.gk, qk = k.qk;
  const waarschuwingen: string[] = [];
  if (k.liggerId && p) {
    const l = p.liggers.find((x) => x.id === k.liggerId);
    if (l) {
      const r = rekenLigger(l);
      const tussen = r.spans.length === 2;
      gk += tussen ? r.reacties[1]! / 1.35 : r.reactie.gk; // benadering bij een tussensteun: R_d / 1,35 als G (veilige kant: γ hieronder opnieuw)
      if (!tussen) qk += r.reactie.qk;
      if (tussen) waarschuwingen.push("Normaalkracht uit de tussensteun van de ligger: vereenvoudigd als permanente last (R_d / 1,35) — ingenieur.");
    }
  }
  const NEd = 1.35 * gk + 1.5 * qk;
  const reeksen = new Set<Profiel["reeks"]>(k.reeksen ?? ["HEA", "HEB"]);
  const resultaten = PROFIELEN.filter((pr) => reeksen.has(pr.reeks)).map((pr) => {
    const g = berekendeGrootheden(pr);
    const A = pr.A * 100; // mm²
    const eps = Math.sqrt(235 / fy), l1 = 93.9 * eps;
    const NcRd = (A * fy) / GAMMA_M0 / 1000;
    let NbRd = Infinity, uitleg = "";
    for (const as of ["y", "z"] as const) {
      const I = as === "y" ? pr.Iy * 1e4 : g.Iz;
      const i = Math.sqrt(I / A);
      const lam = k.lengte / i / l1;
      const a = kromme(pr, as, fy);
      const phi = 0.5 * (1 + a * (lam - 0.2) + lam * lam);
      const chi = Math.min(1, 1 / (phi + Math.sqrt(Math.max(0, phi * phi - lam * lam))));
      const N = (chi * A * fy) / GAMMA_M1 / 1000;
      if (N < NbRd) { NbRd = N; uitleg = `knik om de ${as}-as: λ̄ = ${lam.toFixed(2)}, kromme ${a === 0.49 ? "c" : a === 0.34 ? "b" : "a"}, χ = ${chi.toFixed(2)}`; }
    }
    // doorsnedeklasse onder druk (flens c/t ≤ 14ε, lijf c/t ≤ 42ε voor klasse 3)
    const cf = (pr.b - pr.tw - 2 * pr.r) / 2 / pr.tf, cw = (pr.h - 2 * pr.tf - 2 * pr.r) / pr.tw;
    const klasse = cf <= 14 * eps && cw <= 42 * eps ? 3 : 4;
    const N = Math.min(NbRd, NcRd);
    return { profiel: pr, NbRd: N, NcRd, uc: NEd / N, ok: NEd <= N && klasse <= 3, uitleg, klasse };
  });
  const goed = resultaten.filter((x) => x.ok);
  const keuze = goed.reduce<KolomResultaat["keuze"]>((b, x) => (!b || x.profiel.G < b.profiel.G ? x : b), null);
  waarschuwingen.push("Aanname: kolom scharnierend aan beide uiteinden (kniklengte = ingegeven lengte), zuiver centrische druk, geen momenten of excentriciteit. Voetplaat, kopplaat, verankering en fundering: ingenieur.");
  if (!keuze) waarschuwingen.push("Geen profiel uit de tabel voldoet.");
  return { invoer: k, NEd, resultaten, keuze, waarschuwingen };
}
