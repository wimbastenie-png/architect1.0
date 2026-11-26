/**
 * EPC/EPB-inventaris: voorbereiding voor de energiedeskundige.
 *
 * - Samenstelling per muur, vloer en dak (lagen + U-waarde, of een ingegeven
 *   U-waarde met bron), ramen (Ug, Uf, zonwering), beschermd volume, grenzen.
 * - Invoerlijst per oriëntatie (oppervlaktes, U-waarden, volume) als
 *   voorbereiding op de OFFICIËLE EPB/EPC-software. De app berekent GEEN
 *   EPC-score of E-peil en geeft geen oordeel "conform".
 *
 * U-waarde uit lagen (vereenvoudigd volgens NBN EN ISO 6946):
 *   U = 1 / (Rsi + Σ d/λ + Σ R_luchtlaag + Rse)
 * Rsi: 0,13 (muur), 0,10 (warmte naar boven: dak/plafond), 0,17 (naar beneden: vloer).
 * Rse: 0,04 naar buiten; naar grond, onverwarmd of buren: Rse = Rsi (vereenvoudiging).
 * Geen correctie voor bevestigingen, koudebruggen of grondcontact (EPB-methode in de software).
 */
import { muurVorm, richting } from "./geometrie.ts";
import { vloerNetto } from "./bewerken.ts";
import { muurToestand, openingToestand, verdiepingInToestand } from "./ontwerp.ts";
import type { Grens, Muur, Opening, Project, Samenstelling, Verdieping } from "./schema.ts";

export const EPB_DISCLAIMER =
  "Inventaris ter voorbereiding van het EPC/EPB-dossier. Geen EPC-score, geen E-peil, geen oordeel 'conform'. Waarden en oppervlaktes te controleren door de energiedeskundige; de officiële software rekent.";

export interface MateriaalLambda { naam: string; lambda?: number; r?: number; isolatie?: boolean }

/** Richtwaarden λ (W/mK), te vervangen door de waarde van de fiche als die gekend is. */
export const LAAG_MATERIALEN: MateriaalLambda[] = [
  { naam: "Gipspleister", lambda: 0.52 },
  { naam: "Kalk-/cementpleister", lambda: 0.93 },
  { naam: "Gipskartonplaat", lambda: 0.25 },
  { naam: "Metselwerk volle baksteen", lambda: 0.9 },
  { naam: "Metselwerk snelbouwsteen", lambda: 0.4 },
  { naam: "Gevelsteen (buitenblad)", lambda: 0.9 },
  { naam: "Kalkzandsteen", lambda: 1.0 },
  { naam: "Cellenbeton", lambda: 0.15 },
  { naam: "Beton (gewapend)", lambda: 2.3 },
  { naam: "Chape (zandcement)", lambda: 1.3 },
  { naam: "Tegels", lambda: 1.3 },
  { naam: "Hout / OSB", lambda: 0.13 },
  { naam: "Luchtlaag (niet geventileerd, ≥ 2 cm)", r: 0.17 },
  { naam: "PIR/PUR-isolatie", lambda: 0.023, isolatie: true },
  { naam: "Minerale wol (glas/rots)", lambda: 0.035, isolatie: true },
  { naam: "EPS", lambda: 0.035, isolatie: true },
  { naam: "XPS", lambda: 0.034, isolatie: true },
  { naam: "Houtvezelisolatie", lambda: 0.04, isolatie: true },
  { naam: "Cellulose (ingeblazen)", lambda: 0.04, isolatie: true },
  { naam: "PUR gespoten (vloer)", lambda: 0.028, isolatie: true },
];

export const GLAS = [
  { naam: "Enkel glas", ug: 5.8 },
  { naam: "Dubbel glas (oud, ± 1975–2000)", ug: 2.9 },
  { naam: "Hoogrendementsglas (HR++)", ug: 1.1 },
  { naam: "Drievoudig glas", ug: 0.6 },
] as const;

export const SCHRIJNWERK = [
  { naam: "Hout", uf: 1.8 },
  { naam: "PVC", uf: 1.6 },
  { naam: "Aluminium zonder thermische onderbreking", uf: 5.9 },
  { naam: "Aluminium met thermische onderbreking", uf: 2.4 },
] as const;

export type Plaats = "muur" | "vloer" | "dak";
const RSI: Record<Plaats, number> = { muur: 0.13, vloer: 0.17, dak: 0.1 };

/** U-waarde uit de lagen (W/m²K), of null als er geen lagen zijn. */
export function uUitLagen(s: Samenstelling | undefined, plaats: Plaats): number | null {
  if (!s?.lagen.length) return null;
  const grens: Grens = s.grens ?? "buiten";
  const rse = grens === "buiten" ? 0.04 : RSI[plaats];
  let R = RSI[plaats] + rse;
  for (const l of s.lagen) {
    if (l.r !== undefined) R += l.r;
    else if (l.lambda) R += l.dikte / 1000 / l.lambda;
  }
  return Math.round((1 / R) * 1000) / 1000;
}

/** U-waarde om te gebruiken: ingegeven gaat voor berekend. */
export function uWaarde(s: Samenstelling | undefined, plaats: Plaats): { u: number | null; herkomst: "ingegeven" | "berekend" | "onbekend" } {
  if (s?.uIngegeven) return { u: s.uIngegeven, herkomst: "ingegeven" };
  const u = uUitLagen(s, plaats);
  return u === null ? { u: null, herkomst: "onbekend" } : { u, herkomst: "berekend" };
}

/** Uw van een raam (vereenvoudigd, zonder randverlies ψg): oppervlakte-gewogen met een kaderaandeel van 30 %. */
export function uRaam(o: Opening): number | null {
  if (o.epb?.uw) return o.epb.uw;
  if (o.epb?.ug === undefined || o.epb?.uf === undefined) return null;
  return Math.round((0.7 * o.epb.ug + 0.3 * o.epb.uf) * 100) / 100;
}

export const RICHTINGEN = ["N", "NO", "O", "ZO", "Z", "ZW", "W", "NW"] as const;
export type Richting = (typeof RICHTINGEN)[number];

/** Kompasrichting van een buitennormaal (plan: y naar boven) met het noorden op `noord` graden (met de klok mee van boven). */
export function kompas(n: { x: number; y: number }, noord: number): { richting: Richting; graden: number } {
  // hoek van de normaal met de klok mee vanaf plan-boven
  const vanBoven = ((Math.atan2(n.x, n.y) * 180) / Math.PI + 360) % 360;
  const azimut = (vanBoven - noord + 360) % 360; // 0 = noord, 90 = oost
  return { richting: RICHTINGEN[Math.round(azimut / 45) % 8]!, graden: Math.round(azimut) };
}

/** Standaardgrens van een muur: buitenmuur (één ruimte) → buiten, tussenmuur → binnen. */
export function muurGrens(m: Muur, v: Verdieping): Grens {
  if (m.epb?.grens) return m.epb.grens;
  const n = v.ruimtes.filter((r) => r.muurIds.includes(m.id)).length;
  return n >= 2 ? "binnen" : "buiten";
}

export interface EpbRegel {
  soort: "muur" | "raam" | "deur" | "vloer" | "dak";
  verdieping: string;
  element: string;
  grens: Grens;
  richting?: Richting;
  azimut?: number;
  /** Netto oppervlakte (m²). */
  oppervlakte: number;
  u: number | null;
  herkomst: "ingegeven" | "berekend" | "onbekend";
  isolatie?: string;
  extra?: string;
  bron?: string;
  fotos: number;
}

export interface EpbInventaris {
  regels: EpbRegel[];
  perRichting: Array<{ richting: Richting; muren: number; ramen: number; deuren: number }>;
  /** Beschermd volume: netto binnenvolume (m³) en vloeroppervlakte (m²) van de ruimtes binnen het beschermd volume. */
  volume: number;
  vloeroppervlakte: number;
  ontbrekend: string[];
}

/** Buitenlengte van een muur (langste vlak van de muurvorm). */
function buitenLengte(m: Muur, alle: Muur[]): number {
  const v = muurVorm(m, alle);
  const a = Math.hypot(v[1]!.x - v[0]!.x, v[1]!.y - v[0]!.y), b = Math.hypot(v[2]!.x - v[3]!.x, v[2]!.y - v[3]!.y);
  return Math.max(a, b);
}

export function epbInventaris(p: Project, o: { toestand?: "bestaand" | "nieuw" } = {}): EpbInventaris {
  const regels: EpbRegel[] = [];
  const ontbrekend: string[] = [];
  let volume = 0, vloer = 0;
  const verd = [...p.verdiepingen].sort((a, b) => a.peil - b.peil);
  for (const [vi, v0] of verd.entries()) {
    const v = verdiepingInToestand(v0, o.toestand ?? "nieuw");
    const beschermd = v.ruimtes.filter((r) => r.beschermd !== false);
    for (const r of beschermd) { vloer += vloerNetto(r, v) / 1e6; volume += (vloerNetto(r, v) * r.plafondhoogte) / 1e9; }
    if (!beschermd.length) continue;
    const midden = { x: 0, y: 0 };
    const pts = beschermd.flatMap((r) => r.contour);
    for (const q of pts) { midden.x += q.x / pts.length; midden.y += q.y / pts.length; }
    for (const m of v.muren) {
      if (muurToestand(m) === "afbreken") continue;
      const grens = muurGrens(m, v);
      if (grens === "binnen") continue;
      // alleen muren die een beschermde ruimte begrenzen
      if (!beschermd.some((r) => r.muurIds.includes(m.id))) continue;
      const u = richting(m);
      let n = { x: -u.y, y: u.x };
      const c = { x: (m.start.x + m.eind.x) / 2, y: (m.start.y + m.eind.y) / 2 };
      const ref = beschermd.find((r) => r.muurIds.includes(m.id))!;
      const z = ref.contour.reduce((s, q) => ({ x: s.x + q.x / ref.contour.length, y: s.y + q.y / ref.contour.length }), { x: 0, y: 0 });
      if ((z.x - c.x) * n.x + (z.y - c.y) * n.y > 0) n = { x: -n.x, y: -n.y };
      const k = kompas(n, p.noord ?? 0);
      const naam = `Muur ${m.id.split("@")[0]}`;
      const gaten = v.openingen.filter((x) => x.muurId === m.id && openingToestand(x) !== "dicht");
      const bruto = (buitenLengte(m, v.muren) * m.hoogte) / 1e6;
      const gat = gaten.reduce((s, x) => s + (x.breedte * x.hoogte) / 1e6, 0);
      const uw = uWaarde(m.epb, "muur");
      const iso = m.epb?.lagen.filter((l) => /isolatie|PIR|PUR|EPS|XPS|wol|cellulose/i.test(l.materiaal)).map((l) => `${l.materiaal} ${l.dikte} mm`).join(", ");
      regels.push({ soort: "muur", verdieping: v.naam, element: naam, grens, richting: grens === "buiten" ? k.richting : undefined, azimut: grens === "buiten" ? k.graden : undefined, oppervlakte: r2(bruto - gat), u: uw.u, herkomst: uw.herkomst, isolatie: iso || undefined, bron: m.epb?.bron, fotos: m.epb?.fotos.length ?? 0 });
      if (uw.u === null) ontbrekend.push(`${v.naam}: ${naam} — samenstelling of U-waarde ontbreekt`);
      for (const x of gaten) {
        const ur = x.soort === "raam" ? uRaam(x) : x.epb?.uw ?? null;
        const soort = x.soort === "raam" ? "raam" : "deur";
        regels.push({ soort, verdieping: v.naam, element: `${soort === "raam" ? "Raam" : x.soort === "deur" ? "Deur" : "Doorgang"} ${x.id.split("@")[0]} (${x.breedte} × ${x.hoogte})`, grens, richting: grens === "buiten" ? k.richting : undefined, azimut: grens === "buiten" ? k.graden : undefined, oppervlakte: r2((x.breedte * x.hoogte) / 1e6), u: ur, herkomst: x.epb?.uw ? "ingegeven" : ur === null ? "onbekend" : "berekend", extra: [x.epb?.glas && `glas: ${x.epb.glas}${x.epb.ug ? ` (Ug ${String(x.epb.ug).replace(".", ",")})` : ""}`, x.epb?.schrijnwerk && `kader: ${x.epb.schrijnwerk}${x.epb.uf ? ` (Uf ${String(x.epb.uf).replace(".", ",")})` : ""}`, x.epb?.zonwering && x.epb.zonwering !== "geen" && `zonwering: ${x.epb.zonwering}`].filter(Boolean).join("; ") || undefined, bron: x.epb?.bron, fotos: x.epb?.fotos.length ?? 0 });
        if (ur === null && x.soort === "raam") ontbrekend.push(`${v.naam}: raam ${x.id.split("@")[0]} — glas (Ug) en kader (Uf) ontbreken`);
      }
    }
    // vloer onderaan en plafond/dak bovenaan, als de verdieping eronder/erboven niet beschermd is (of er geen is)
    const opp = beschermd.reduce((s, r) => s + vloerNetto(r, v) / 1e6, 0);
    const onder = verd[vi - 1], boven = verd[vi + 1];
    const onderBeschermd = onder?.ruimtes.some((r) => r.beschermd !== false);
    const bovenBeschermd = boven?.ruimtes.some((r) => r.beschermd !== false);
    if (!onderBeschermd) {
      const s = v0.epb?.vloer, uw = uWaarde(s, "vloer");
      regels.push({ soort: "vloer", verdieping: v.naam, element: `Vloer ${v.naam}`, grens: s?.grens ?? (onder ? "onverwarmd" : "grond"), oppervlakte: r2(opp), u: uw.u, herkomst: uw.herkomst, bron: s?.bron, fotos: s?.fotos.length ?? 0 });
      if (uw.u === null) ontbrekend.push(`${v.naam}: vloer — samenstelling of U-waarde ontbreekt`);
    }
    if (!bovenBeschermd) {
      const s = v0.epb?.plafond, uw = uWaarde(s, "dak");
      regels.push({ soort: "dak", verdieping: v.naam, element: `Dak/plafond ${v.naam}`, grens: s?.grens ?? (boven ? "onverwarmd" : "buiten"), oppervlakte: r2(opp), u: uw.u, herkomst: uw.herkomst, bron: s?.bron, fotos: s?.fotos.length ?? 0 });
      if (uw.u === null) ontbrekend.push(`${v.naam}: dak of plafond — samenstelling of U-waarde ontbreekt`);
    }
  }
  const perRichting = RICHTINGEN.map((richting) => ({
    richting,
    muren: r2(regels.filter((r) => r.soort === "muur" && r.richting === richting).reduce((s, r) => s + r.oppervlakte, 0)),
    ramen: r2(regels.filter((r) => r.soort === "raam" && r.richting === richting).reduce((s, r) => s + r.oppervlakte, 0)),
    deuren: r2(regels.filter((r) => r.soort === "deur" && r.richting === richting).reduce((s, r) => s + r.oppervlakte, 0)),
  })).filter((x) => x.muren + x.ramen + x.deuren > 0);
  return { regels, perRichting, volume: r2(volume), vloeroppervlakte: r2(vloer), ontbrekend };
}

const r2 = (x: number) => Math.round(x * 100) / 100;
const g = (x: number | null | undefined, d = 2) => (x === null || x === undefined ? "" : x.toFixed(d).replace(".", ","));
const t = (s: string | undefined) => (s === undefined ? "" : /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** Excel (Belgisch: ; en decimale komma). */
export function epbCSV(p: Project, inv = epbInventaris(p)): string {
  const r: string[] = [];
  r.push(["Soort", "Verdieping", "Element", "Grenst aan", "Richting", "Azimut (°)", "Oppervlakte (m²)", "U (W/m²K)", "U: herkomst", "Isolatie", "Glas / kader / zonwering", "Bron", "Foto's"].join(";"));
  for (const x of inv.regels) r.push([x.soort, t(x.verdieping), t(x.element), x.grens, x.richting ?? "", x.azimut ?? "", g(x.oppervlakte), g(x.u, 3), x.herkomst, t(x.isolatie), t(x.extra), t(x.bron), String(x.fotos)].join(";"));
  r.push("");
  r.push(["Per richting", "Muren (m²)", "Ramen (m²)", "Deuren (m²)"].join(";"));
  for (const x of inv.perRichting) r.push([x.richting, g(x.muren), g(x.ramen), g(x.deuren)].join(";"));
  r.push("");
  r.push(`Beschermd volume (netto binnenvolume, m³);${g(inv.volume)}`);
  r.push(`Vloeroppervlakte beschermd volume (netto, m²);${g(inv.vloeroppervlakte)}`);
  r.push(`Noorden op het plan (graden met de klok mee vanaf boven);${p.noord ?? 0}`);
  r.push("");
  r.push(t("Oppervlaktes: muren op buitenlengte × verdiepingshoogte min openingen; vloer en dak op netto vloeroppervlakte. De EPB-software gebruikt eigen meetregels (buitenafmetingen): na te kijken."));
  r.push(t("U-waarde berekend volgens een vereenvoudigde NBN EN ISO 6946 (zonder koudebruggen, bevestigingen of grondcorrectie); λ-waarden zijn richtwaarden tenzij een bron vermeld is."));
  r.push(t(EPB_DISCLAIMER));
  return "﻿" + r.join("\r\n") + "\r\n";
}
