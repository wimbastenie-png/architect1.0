/**
 * Installaties: elektriciteit, sanitair en gas op het plan.
 *
 * Uit de punten op het plan berekent de app een VOORSTEL: kringen met
 * automaten en kabeldoorsnedes (eendraadschema), leidingen met diameter,
 * materiaal en helling, een materiaallijst en aandachtspunten.
 *
 * Belangrijk — staat ook in de app en op elk PDF-blad:
 * - De app vervangt de installateur en de keuring niet.
 * - Aandachtspunten zijn GEEN keuring en geen oordeel "conform". Ze volgen
 *   gangbare regels (AREI, NBN, praktijk) zoals de app ze kent, en moeten
 *   altijd nagekeken worden door een installateur of keurder.
 * - Gas: een bevoegde installateur ontwerpt en voert uit; keuring verplicht
 *   vóór ingebruikname (NBN D 51-003, na te kijken).
 */
import type { InstallatiePunt, Project, Punt, Ruimte, Verdieping } from "./schema.ts";

export type Net = InstallatiePunt["net"];

export interface SoortDef {
  soort: string;
  net: Net;
  naam: string;
  /** Kort label op het plan. */
  code: string;
  /** Standaardhoogte boven de vloer (mm). */
  hoogte: number;
  /** Elektriciteit: hoe het punt in kringen komt. */
  kring?: "licht" | "schakelaar" | "stop" | "apart" | "bord";
  /** Aparte kring: automaat (A) en kabel (mm²). */
  apart?: { automaat: number; kabel: number; dertig: boolean };
  /** Sanitair: nodig koud / warm water en afvoerdiameter (mm). */
  koud?: boolean;
  warm?: boolean;
  afvoer?: number;
  /** Bron of aansluiting van een net (verdeelbord, watermeter, boiler, afvoer, gasmeter). */
  bron?: "bord" | "koud" | "warm" | "afvoer" | "gas";
  /** Gastoestel. */
  gastoestel?: boolean;
}

export const SOORTEN: SoortDef[] = [
  // elektriciteit
  { soort: "verdeelbord", net: "elektriciteit", naam: "Verdeelbord", code: "VB", hoogte: 1500, kring: "bord", bron: "bord" },
  { soort: "stopcontact", net: "elektriciteit", naam: "Stopcontact", code: "S", hoogte: 300, kring: "stop" },
  { soort: "stopcontact-dubbel", net: "elektriciteit", naam: "Dubbel stopcontact", code: "S2", hoogte: 300, kring: "stop" },
  { soort: "schakelaar", net: "elektriciteit", naam: "Schakelaar", code: "SCH", hoogte: 1100, kring: "schakelaar" },
  { soort: "lichtpunt", net: "elektriciteit", naam: "Lichtpunt (plafond)", code: "L", hoogte: 2500, kring: "licht" },
  { soort: "wandlicht", net: "elektriciteit", naam: "Lichtpunt (wand)", code: "LW", hoogte: 1900, kring: "licht" },
  { soort: "kookplaat", net: "elektriciteit", naam: "Elektrische kookplaat", code: "KP", hoogte: 600, kring: "apart", apart: { automaat: 32, kabel: 6, dertig: false } },
  { soort: "oven", net: "elektriciteit", naam: "Oven", code: "OV", hoogte: 600, kring: "apart", apart: { automaat: 20, kabel: 2.5, dertig: false } },
  { soort: "wasmachine", net: "elektriciteit", naam: "Wasmachine", code: "WM", hoogte: 1100, kring: "apart", apart: { automaat: 20, kabel: 2.5, dertig: true } },
  { soort: "droogkast", net: "elektriciteit", naam: "Droogkast", code: "DK", hoogte: 1100, kring: "apart", apart: { automaat: 20, kabel: 2.5, dertig: true } },
  { soort: "vaatwas", net: "elektriciteit", naam: "Vaatwasser", code: "VW", hoogte: 600, kring: "apart", apart: { automaat: 20, kabel: 2.5, dertig: true } },
  { soort: "boiler-elektrisch", net: "elektriciteit", naam: "Elektrische boiler", code: "EB", hoogte: 1800, kring: "apart", apart: { automaat: 20, kabel: 2.5, dertig: false } },
  // sanitair
  { soort: "watermeter", net: "sanitair", naam: "Watermeter / kraan in", code: "WMT", hoogte: 300, bron: "koud" },
  { soort: "boiler", net: "sanitair", naam: "Boiler / warmwatertoestel", code: "BO", hoogte: 1500, bron: "warm", koud: true },
  { soort: "afvoer", net: "sanitair", naam: "Aansluiting afvoer (valpijp, riool)", code: "AF", hoogte: 0, bron: "afvoer" },
  { soort: "wastafel", net: "sanitair", naam: "Wastafel", code: "WT", hoogte: 550, koud: true, warm: true, afvoer: 40 },
  { soort: "wc", net: "sanitair", naam: "Wc", code: "WC", hoogte: 150, koud: true, afvoer: 110 },
  { soort: "douche", net: "sanitair", naam: "Douche", code: "DO", hoogte: 1100, koud: true, warm: true, afvoer: 50 },
  { soort: "bad", net: "sanitair", naam: "Bad", code: "BA", hoogte: 700, koud: true, warm: true, afvoer: 50 },
  { soort: "spoeltafel", net: "sanitair", naam: "Spoeltafel keuken", code: "SP", hoogte: 550, koud: true, warm: true, afvoer: 50 },
  { soort: "wasmachine-water", net: "sanitair", naam: "Wasmachine (water + afvoer)", code: "WMA", hoogte: 900, koud: true, afvoer: 50 },
  { soort: "vaatwas-water", net: "sanitair", naam: "Vaatwasser (water + afvoer)", code: "VWA", hoogte: 300, koud: true, afvoer: 40 },
  { soort: "buitenkraan", net: "sanitair", naam: "Buitenkraan", code: "BK", hoogte: 600, koud: true },
  // gas
  { soort: "gasmeter", net: "gas", naam: "Gasmeter", code: "GM", hoogte: 1000, bron: "gas" },
  { soort: "gasketel", net: "gas", naam: "Gasketel", code: "GK", hoogte: 1500, gastoestel: true },
  { soort: "gaskookplaat", net: "gas", naam: "Gaskookplaat", code: "GKP", hoogte: 850, gastoestel: true },
  { soort: "gashaard", net: "gas", naam: "Gashaard", code: "GH", hoogte: 300, gastoestel: true },
];

const DEF = new Map(SOORTEN.map((s) => [s.soort, s]));
export function soortDef(soort: string): SoortDef | undefined {
  return DEF.get(soort);
}

export const INSTALLATIE_DISCLAIMER =
  "Voorstel ter voorbereiding. De app vervangt de installateur en de keuring niet. Aandachtspunten zijn geen keuring en geen oordeel 'conform': na te kijken door een installateur of keurder.";

export const GAS_WAARSCHUWING =
  "GAS: een bevoegde installateur moet de gasinstallatie ontwerpen en uitvoeren. Keuring verplicht vóór ingebruikname (NBN D 51-003, na te kijken). Dit plan is enkel een voorbereiding; de app geeft geen oordeel 'conform'.";

// ---------------------------------------------------------------------------
// punten bewerken

export function voegInstallatiepuntToe(v: Verdieping, soort: string, positie: Punt, hoogte?: number): { verdieping: Verdieping; id: string } {
  const d = DEF.get(soort);
  if (!d) throw new Error(`Onbekende soort '${soort}'.`);
  const bestaand = new Set(v.installaties.map((x) => x.id));
  let n = v.installaties.length + 1;
  const basis = `i-${d.code.toLowerCase()}`;
  while (bestaand.has(`${basis}${n}@${v.id}`)) n++;
  const id = `${basis}${n}@${v.id}`;
  const p: InstallatiePunt = { id, net: d.net, soort, positie: { x: Math.round(positie.x), y: Math.round(positie.y) }, hoogte: Math.round(hoogte ?? d.hoogte) };
  return { verdieping: { ...v, installaties: [...v.installaties, p] }, id };
}

export function wijzigInstallatiepunt(v: Verdieping, id: string, w: Partial<Pick<InstallatiePunt, "positie" | "hoogte" | "kring" | "opmerking" | "soort">>): Verdieping {
  return { ...v, installaties: v.installaties.map((x) => (x.id === id ? { ...x, ...w, kring: w.kring === "" ? undefined : (w.kring ?? x.kring) } : x)) };
}

export function verwijderInstallatiepunt(v: Verdieping, id: string): Verdieping {
  return { ...v, installaties: v.installaties.filter((x) => x.id !== id) };
}

// ---------------------------------------------------------------------------
// hulp

const binnen = (p: Punt, c: Punt[]) => {
  let in_ = false;
  for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
    const a = c[i]!, b = c[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) in_ = !in_;
  }
  return in_;
};

/** Ruimte waarin een punt ligt (of de dichtste, voor punten in/tegen een muur). */
export function ruimteVan(v: Verdieping, p: Punt): Ruimte | undefined {
  const r = v.ruimtes.find((x) => binnen(p, x.contour));
  if (r) return r;
  let beste: Ruimte | undefined, d = 400; // tot 40 cm buiten de vloer (in de muur)
  for (const x of v.ruimtes) {
    for (let k = 0; k < x.contour.length; k++) {
      const a = x.contour[k]!, b = x.contour[(k + 1) % x.contour.length]!;
      const L2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / L2));
      const dd = Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y)));
      if (dd < d) { d = dd; beste = x; }
    }
  }
  return beste;
}

const isNat = (r: Ruimte | undefined, v: Verdieping) => {
  if (!r) return false;
  if (/bad|douche|wasplaats|wasruimte/i.test(r.naam)) return true;
  return v.installaties.some((x) => (x.soort === "douche" || x.soort === "bad") && ruimteVan(v, x.positie)?.id === r.id);
};

/** Lengte van een pad. */
const padLengte = (pad: Punt[]) => pad.slice(1).reduce((s, q, i) => s + Math.hypot(q.x - pad[i]!.x, q.y - pad[i]!.y), 0);
/** Haaks pad: eerst langs x, dan langs y (leidingen lopen evenwijdig aan de muren). */
const haaksPad = (a: Punt, b: Punt): Punt[] => (a.x === b.x || a.y === b.y ? [a, b] : [a, { x: b.x, y: a.y }, b]);

// ---------------------------------------------------------------------------
// elektriciteit: kringen

export interface Kring {
  code: string;
  omschrijving: string;
  soort: "verlichting" | "stopcontacten" | "apart";
  automaat: number;
  kabel: number;
  /** Differentieel: 30 mA (badkamer, wasmachine …) of de algemene 300 mA. */
  differentieel: 30 | 300;
  punten: Array<{ verdieping: string; punt: InstallatiePunt; ruimte?: string }>;
  /** Geschatte kabellengte (m), incl. op- en neergaan en 15 % marge. */
  kabelLengte: number;
}

/** Max. aantal stopcontacten (enkel of meervoudig) per kring — AREI, na te kijken. */
export const MAX_STOPCONTACTEN = 8;
/** Keuze van de app (geen AREI-regel): max. lichtpunten per verlichtingskring. */
export const MAX_LICHTPUNTEN = 10;

function verdeelbord(p: Project): { v: Verdieping; punt: InstallatiePunt } | null {
  for (const v of p.verdiepingen) for (const x of v.installaties) if (x.soort === "verdeelbord") return { v, punt: x };
  return null;
}

/** Kabellengte langs een keten van punten vanaf het bord (haaks, met op/neer naar de vloer of het plafond). */
function kabel(bord: { v: Verdieping; punt: InstallatiePunt } | null, pts: Array<{ v: Verdieping; punt: InstallatiePunt }>): number {
  if (!pts.length) return 0;
  let L = 0;
  let huidig = bord ? { v: bord.v, q: bord.punt.positie, h: bord.punt.hoogte } : { v: pts[0]!.v, q: pts[0]!.punt.positie, h: pts[0]!.punt.hoogte };
  const over = [...pts];
  while (over.length) {
    // dichtste volgende punt (zelfde verdieping eerst)
    let bi = 0, bd = Infinity;
    over.forEach((x, i) => {
      const d = Math.abs(x.punt.positie.x - huidig.q.x) + Math.abs(x.punt.positie.y - huidig.q.y) + (x.v.id === huidig.v.id ? 0 : 1e6);
      if (d < bd) { bd = d; bi = i; }
    });
    const x = over.splice(bi, 1)[0]!;
    const plafond = Math.max(2400, ...x.v.ruimtes.map((r) => r.plafondhoogte));
    const vlak = Math.abs(x.punt.positie.x - huidig.q.x) + Math.abs(x.punt.positie.y - huidig.q.y);
    // kabel loopt in het plafond of de vloer: op en neer naar het punt
    const vert = x.v.id === huidig.v.id ? Math.min(huidig.h + x.punt.hoogte, 2 * plafond - huidig.h - x.punt.hoogte) : Math.abs(x.v.peil - huidig.v.peil) + x.punt.hoogte;
    L += vlak + vert;
    huidig = { v: x.v, q: x.punt.positie, h: x.punt.hoogte };
  }
  return Math.round((L * 1.15) / 100) / 10; // m, 1 decimaal
}

/**
 * Voorstel van kringen. Punten met een vaste `kring` worden samen gezet;
 * de rest automatisch: verlichting per verdieping, stopcontacten per verdieping
 * (max. 8 per kring; natte ruimtes apart op 30 mA), grote toestellen elk een eigen kring.
 */
export function kringenVoorstel(p: Project): Kring[] {
  const bord = verdeelbord(p);
  type Item = { v: Verdieping; punt: InstallatiePunt; def: SoortDef; ruimte?: Ruimte };
  const items: Item[] = [];
  for (const v of p.verdiepingen) for (const x of v.installaties) {
    const def = DEF.get(x.soort);
    if (x.net !== "elektriciteit" || !def || def.kring === "bord") continue;
    items.push({ v, punt: x, def, ruimte: ruimteVan(v, x.positie) });
  }
  const kringen: Array<Omit<Kring, "code" | "kabelLengte"> & { items: Item[] }> = [];
  const maak = (omschrijving: string, soort: Kring["soort"], automaat: number, kabel_: number, differentieel: 30 | 300, it: Item[]) =>
    kringen.push({ omschrijving, soort, automaat, kabel: kabel_, differentieel, items: it, punten: [] });

  // vaste kringen
  const vast = new Map<string, Item[]>();
  for (const it of items) if (it.punt.kring) vast.set(it.punt.kring, [...(vast.get(it.punt.kring) ?? []), it]);
  const auto = items.filter((it) => !it.punt.kring);

  for (const v of p.verdiepingen) {
    const hier = auto.filter((it) => it.v.id === v.id);
    const licht = hier.filter((it) => it.def.kring === "licht" || it.def.kring === "schakelaar");
    for (const nat of [false, true]) {
      const lp = licht.filter((it) => it.def.kring === "licht" && isNat(it.ruimte, v) === nat);
      for (let i = 0; i < lp.length; i += MAX_LICHTPUNTEN) {
        const deel = lp.slice(i, i + MAX_LICHTPUNTEN);
        const ruimtes = new Set(deel.map((x) => x.ruimte?.id));
        const sch = licht.filter((it) => it.def.kring === "schakelaar" && ruimtes.has(it.ruimte?.id));
        maak(`Verlichting ${v.naam}${nat ? " natte ruimtes" : ""}${lp.length > MAX_LICHTPUNTEN ? ` (${i / MAX_LICHTPUNTEN + 1})` : ""}`, "verlichting", 16, 1.5, nat ? 30 : 300, [...deel, ...sch]);
      }
    }
    // schakelaars zonder lichtpunt in dezelfde ruimte: bij de eerste verlichtingskring van de verdieping
    const gebruikt = new Set(kringen.flatMap((k) => k.items.map((x) => x.punt.id)));
    const los = licht.filter((it) => !gebruikt.has(it.punt.id));
    if (los.length) {
      const k = kringen.find((x) => x.soort === "verlichting" && x.items.some((it) => it.v.id === v.id));
      if (k) k.items.push(...los); else maak(`Verlichting ${v.naam}`, "verlichting", 16, 1.5, 300, los);
    }
    const stop = hier.filter((it) => it.def.kring === "stop");
    for (const nat of [false, true]) {
      const groep = stop.filter((it) => isNat(it.ruimte, v) === nat).sort((a, b) => (a.ruimte?.naam ?? "").localeCompare(b.ruimte?.naam ?? ""));
      for (let i = 0; i < groep.length; i += MAX_STOPCONTACTEN) {
        const n = Math.ceil(groep.length / MAX_STOPCONTACTEN);
        maak(`Stopcontacten ${v.naam}${nat ? " natte ruimtes" : ""}${n > 1 ? ` (${i / MAX_STOPCONTACTEN + 1})` : ""}`, "stopcontacten", 20, 2.5, nat ? 30 : 300, groep.slice(i, i + MAX_STOPCONTACTEN));
      }
    }
    for (const it of hier.filter((x) => x.def.kring === "apart")) {
      const a = it.def.apart!;
      maak(`${it.def.naam}${it.ruimte ? ` (${it.ruimte.naam})` : ""}`, "apart", a.automaat, a.kabel, a.dertig || isNat(it.ruimte, v) ? 30 : 300, [it]);
    }
  }
  for (const [code, it] of vast) {
    const apart = it.find((x) => x.def.kring === "apart");
    const stop = it.some((x) => x.def.kring === "stop");
    const nat = it.some((x) => isNat(x.ruimte, x.v));
    if (apart) maak(`Kring ${code}`, "apart", apart.def.apart!.automaat, apart.def.apart!.kabel, nat || apart.def.apart!.dertig ? 30 : 300, it);
    else if (stop) maak(`Kring ${code}`, "stopcontacten", 20, 2.5, nat ? 30 : 300, it);
    else maak(`Kring ${code}`, "verlichting", 16, 1.5, nat ? 30 : 300, it);
  }
  // codes: vaste namen behouden, de rest K1, K2 … (30 mA-groep achteraan, zoals in het bord)
  const vasteCodes = new Set(vast.keys());
  let n = 1;
  const volgende = () => { while (vasteCodes.has(`K${n}`)) n++; return `K${n++}`; };
  const gesorteerd = [...kringen].sort((a, b) => b.differentieel - a.differentieel);
  return gesorteerd.map((k) => ({
    code: k.omschrijving.startsWith("Kring ") ? k.omschrijving.slice(6) : volgende(),
    omschrijving: k.omschrijving,
    soort: k.soort,
    automaat: k.automaat,
    kabel: k.kabel,
    differentieel: k.differentieel,
    punten: k.items.map((it) => ({ verdieping: it.v.naam, punt: it.punt, ruimte: it.ruimte?.naam })),
    kabelLengte: kabel(bord, k.items.map((it) => ({ v: it.v, punt: it.punt }))),
  }));
}

// ---------------------------------------------------------------------------
// sanitair en gas: leidingen

export type LeidingSoort = "koud" | "warm" | "afvoer" | "gas";

export interface Leiding {
  soort: LeidingSoort;
  verdiepingId: string;
  van: string;
  naar: string;
  pad: Punt[];
  lengte: number; // mm
  diameter: number; // mm (uitwendig)
  materiaal: string;
  /** Hoogte van de leiding boven de vloer (mm); afvoer: aan het toestel. */
  hoogte: number;
  /** Afvoer: helling (%) en hoogteverschil over de lengte (mm). */
  helling?: number;
  hoogteverschil?: number;
}

export const AFVOER_HELLING = 2; // % (gangbaar 1 à 2 %)
const MATERIAAL: Record<LeidingSoort, string> = {
  koud: "meerlagenbuis (PE-RT/Al) 16 × 2",
  warm: "meerlagenbuis (PE-RT/Al) 16 × 2, geïsoleerd",
  afvoer: "PP of PE afvoerbuis",
  gas: "staal of koper (gas), geel gemerkt",
};

export function leidingen(p: Project): Leiding[] {
  const uit: Leiding[] = [];
  for (const v of p.verdiepingen) {
    const pts = v.installaties;
    const bron = (b: SoortDef["bron"]) => pts.find((x) => DEF.get(x.soort)?.bron === b) ?? p.verdiepingen.flatMap((w) => w.installaties).find((x) => DEF.get(x.soort)?.bron === b);
    const koud = bron("koud"), warm = bron("warm"), afv = bron("afvoer"), gas = bron("gas");
    const lijn = (soort: LeidingSoort, a: InstallatiePunt | undefined, b: InstallatiePunt, diameter: number, hoogte: number, helling?: number) => {
      if (!a) return;
      const opDeze = v.installaties.includes(a);
      const start = opDeze ? a.positie : b.positie; // bron op een andere verdieping: stijgleiding aan het toestel
      const pad = opDeze ? haaksPad(start, b.positie) : [b.positie];
      const lengte = Math.round(padLengte(pad) + (opDeze ? 0 : Math.abs(v.peil - (p.verdiepingen.find((w) => w.installaties.includes(a))?.peil ?? v.peil))));
      uit.push({
        soort, verdiepingId: v.id, van: a.id, naar: b.id, pad, lengte, diameter, materiaal: soort === "afvoer" ? `${MATERIAAL.afvoer} Ø${diameter}` : MATERIAAL[soort], hoogte,
        ...(helling ? { helling, hoogteverschil: Math.round((lengte * helling) / 100) } : {}),
      });
    };
    for (const x of pts) {
      const d = DEF.get(x.soort);
      if (!d) continue;
      if (d.net === "sanitair" && !d.bron) {
        if (d.koud) lijn("koud", koud, x, 16, Math.min(x.hoogte, 300));
        if (d.warm) lijn("warm", warm, x, 16, Math.min(x.hoogte, 300));
        if (d.afvoer) lijn("afvoer", afv, x, d.afvoer, 0, AFVOER_HELLING);
      }
      if (x.soort === "boiler") lijn("koud", koud, x, 16, 300);
      if (d.gastoestel) lijn("gas", gas, x, x.soort === "gasketel" ? 22 : 15, Math.min(x.hoogte, 1000));
    }
  }
  return uit;
}

// ---------------------------------------------------------------------------
// aandachtspunten

export interface Aandachtspunt {
  net: Net;
  /** "let op": na te kijken vóór uitvoering; "info": algemene regel. */
  ernst: "let op" | "info";
  tekst: string;
  puntId?: string;
}

export function aandachtspunten(p: Project): Aandachtspunt[] {
  const uit: Aandachtspunt[] = [];
  const alle = p.verdiepingen.flatMap((v) => v.installaties.map((x) => ({ v, x })));
  const heeft = (net: Net) => alle.some((a) => a.x.net === net);
  const naam = (x: InstallatiePunt) => DEF.get(x.soort)?.naam ?? x.soort;
  const plek = (v: Verdieping, x: InstallatiePunt) => { const r = ruimteVan(v, x.positie); return r ? ` in ${r.naam}` : ""; };

  if (heeft("elektriciteit")) {
    if (!alle.some((a) => a.x.soort === "verdeelbord")) uit.push({ net: "elektriciteit", ernst: "let op", tekst: "Geen verdeelbord op het plan: kabellengtes zijn geschat zonder vertrekpunt." });
    for (const k of kringenVoorstel(p)) {
      const n = k.punten.filter((x) => DEF.get(x.punt.soort)?.kring === "stop").length;
      if (n > MAX_STOPCONTACTEN) uit.push({ net: "elektriciteit", ernst: "let op", tekst: `Kring ${k.code}: ${n} stopcontacten. Het AREI laat max. ${MAX_STOPCONTACTEN} (enkelvoudige of meervoudige) stopcontacten per kring toe — na te kijken.` });
      if (k.soort === "apart" && k.punten.length > 1) uit.push({ net: "elektriciteit", ernst: "let op", tekst: `Kring ${k.code}: meerdere punten op een kring voor een groot toestel — na te kijken.` });
    }
    for (const { v, x } of alle) {
      if (x.net !== "elektriciteit" || DEF.get(x.soort)?.kring !== "stop") continue;
      for (const y of v.installaties) {
        if (y.soort !== "douche" && y.soort !== "bad") continue;
        const d = Math.hypot(x.positie.x - y.positie.x, x.positie.y - y.positie.y);
        if (d < 1200) uit.push({ net: "elektriciteit", ernst: "let op", puntId: x.id, tekst: `${naam(x)}${plek(v, x)} op ± ${Math.round(d / 10)} cm van ${y.soort === "bad" ? "het bad" : "de douche"} (gemeten tot het symbool). Volumes van de badkamer (AREI): binnen 60 cm van bad of douche gelden strengere regels — na te kijken met de echte afmetingen.` });
      }
    }
    for (const v of p.verdiepingen) {
      for (const r of v.ruimtes) {
        const hier = v.installaties.filter((x) => ruimteVan(v, x.positie)?.id === r.id);
        if (hier.some((x) => DEF.get(x.soort)?.kring === "licht") && !hier.some((x) => x.soort === "schakelaar"))
          uit.push({ net: "elektriciteit", ernst: "let op", tekst: `${r.naam} (${v.naam}): lichtpunt zonder schakelaar in de ruimte.` });
        if (isNat(r, v) && hier.some((x) => x.net === "elektriciteit"))
          uit.push({ net: "elektriciteit", ernst: "info", tekst: `${r.naam} (${v.naam}): natte ruimte — kringen op een differentieel van 30 mA, en beschermingsgraad (IP) van toestellen en schakelaars na te kijken.` });
      }
    }
    uit.push({ net: "elektriciteit", ernst: "info", tekst: "Algemeen differentieel 300 mA; 30 mA voor natte ruimtes en voor wasmachine, droogkast en vaatwasser (gangbare regel, na te kijken). Aarding en equipotentiale verbindingen: na te kijken." });
    uit.push({ net: "elektriciteit", ernst: "info", tekst: "Een nieuwe of grondig gewijzigde installatie moet gekeurd worden door een erkend organisme vóór ingebruikname, met eendraadschema en situatieschema." });
  }

  if (heeft("sanitair")) {
    const ld = leidingen(p);
    const bron = (b: string) => alle.some((a) => DEF.get(a.x.soort)?.bron === b);
    const toestellen = alle.filter((a) => a.x.net === "sanitair" && !DEF.get(a.x.soort)?.bron);
    if (toestellen.some((a) => DEF.get(a.x.soort)?.koud) && !bron("koud")) uit.push({ net: "sanitair", ernst: "let op", tekst: "Geen watermeter / kraan in op het plan: koudwaterleidingen kunnen niet getekend worden." });
    if (toestellen.some((a) => DEF.get(a.x.soort)?.warm) && !bron("warm")) uit.push({ net: "sanitair", ernst: "let op", tekst: "Geen boiler of warmwatertoestel op het plan: warmwaterleidingen kunnen niet getekend worden." });
    if (toestellen.some((a) => DEF.get(a.x.soort)?.afvoer) && !bron("afvoer")) uit.push({ net: "sanitair", ernst: "let op", tekst: "Geen aansluiting op de afvoer (valpijp of riool) op het plan." });
    const ptNaam = (id: string) => { const a = alle.find((x) => x.x.id === id); return a ? `${naam(a.x)}${plek(a.v, a.x)}` : id; };
    for (const l of ld) {
      if (l.soort === "afvoer" && l.hoogteverschil !== undefined && l.hoogteverschil > 150)
        uit.push({ net: "sanitair", ernst: "let op", puntId: l.naar, tekst: `Afvoer ${ptNaam(l.naar)}: ${(l.lengte / 1000).toFixed(1).replace(".", ",")} m bij ${l.helling} % helling = ${Math.round(l.hoogteverschil / 10)} cm hoogteverschil. Past dat in de vloeropbouw of onder het toestel?` });
      if (l.soort === "afvoer" && l.diameter >= 110 && l.lengte > 6000)
        uit.push({ net: "sanitair", ernst: "let op", puntId: l.naar, tekst: `Afvoer ${ptNaam(l.naar)}: lange wc-afvoer (${(l.lengte / 1000).toFixed(1).replace(".", ",")} m). Ontluchting en helling na te kijken.` });
      if (l.soort === "warm" && l.lengte > 10000)
        uit.push({ net: "sanitair", ernst: "info", puntId: l.naar, tekst: `Warm water naar ${ptNaam(l.naar)}: ${(l.lengte / 1000).toFixed(1).replace(".", ",")} m. Lange wachttijd; een circulatieleiding of een toestel dichterbij overwegen.` });
    }
    uit.push({ net: "sanitair", ernst: "info", tekst: "Leidingen zijn een schets: haaks van de bron naar elk toestel. Het echte tracé, de diameters en de ontluchting legt de installateur vast." });
  }

  if (heeft("gas")) {
    uit.push({ net: "gas", ernst: "let op", tekst: GAS_WAARSCHUWING });
    if (alle.some((a) => DEF.get(a.x.soort)?.gastoestel) && !alle.some((a) => a.x.soort === "gasmeter"))
      uit.push({ net: "gas", ernst: "let op", tekst: "Geen gasmeter op het plan." });
    for (const { v, x } of alle) {
      if (!DEF.get(x.soort)?.gastoestel) continue;
      const r = ruimteVan(v, x.positie);
      if (r && /slaap|bad|douche/i.test(r.naam))
        uit.push({ net: "gas", ernst: "let op", puntId: x.id, tekst: `${naam(x)} in ${r.naam}: in slaapkamers en badkamers gelden strenge regels voor gastoestellen (bv. enkel gesloten toestellen, type C) — na te kijken door de installateur.` });
      uit.push({ net: "gas", ernst: "info", puntId: x.id, tekst: `${naam(x)}${plek(v, x)}: afsluitkraan vlak bij het toestel; luchttoevoer en rookgasafvoer na te kijken.` });
    }
  }
  return uit;
}

// ---------------------------------------------------------------------------
// materiaallijst

export interface MateriaalRegel {
  net: Net;
  omschrijving: string;
  eenheid: "st" | "m";
  hoeveelheid: number;
}

export function materiaallijst(p: Project): MateriaalRegel[] {
  const uit: MateriaalRegel[] = [];
  const tel = new Map<string, number>();
  for (const v of p.verdiepingen) for (const x of v.installaties) tel.set(x.soort, (tel.get(x.soort) ?? 0) + 1);
  for (const d of SOORTEN) {
    const n = tel.get(d.soort);
    if (n) uit.push({ net: d.net, omschrijving: d.naam, eenheid: "st", hoeveelheid: n });
  }
  const kringen = kringenVoorstel(p);
  if (kringen.length) {
    const dozen = kringen.reduce((s, k) => s + k.punten.length, 0);
    uit.push({ net: "elektriciteit", omschrijving: "Inbouwdoos / lasdoos (schatting: 1 per punt)", eenheid: "st", hoeveelheid: dozen });
    const perKabel = new Map<number, number>();
    for (const k of kringen) perKabel.set(k.kabel, (perKabel.get(k.kabel) ?? 0) + k.kabelLengte);
    for (const [mm2, m] of [...perKabel].sort((a, b) => a[0] - b[0])) {
      uit.push({ net: "elektriciteit", omschrijving: `Kabel 3G${String(mm2).replace(".", ",")} mm² (of draad in buis)`, eenheid: "m", hoeveelheid: Math.ceil(m) });
    }
    uit.push({ net: "elektriciteit", omschrijving: "Buis (flexibel, Ø 16/20 mm)", eenheid: "m", hoeveelheid: Math.ceil(kringen.reduce((s, k) => s + k.kabelLengte, 0)) });
    const auto = new Map<number, number>();
    for (const k of kringen) auto.set(k.automaat, (auto.get(k.automaat) ?? 0) + 1);
    for (const [a, n] of [...auto].sort((x, y) => x[0] - y[0])) uit.push({ net: "elektriciteit", omschrijving: `Automaat 2P ${a} A (curve C)`, eenheid: "st", hoeveelheid: n });
    uit.push({ net: "elektriciteit", omschrijving: "Differentieel 300 mA (hoofd)", eenheid: "st", hoeveelheid: 1 });
    if (kringen.some((k) => k.differentieel === 30)) uit.push({ net: "elektriciteit", omschrijving: "Differentieel 30 mA (natte ruimtes, toestellen)", eenheid: "st", hoeveelheid: 1 });
  }
  const ld = leidingen(p);
  const groep = new Map<string, { net: Net; m: number; bochten: number }>();
  for (const l of ld) {
    const k = l.materiaal + (l.soort === "warm" ? " (warm)" : l.soort === "koud" ? " (koud)" : "");
    const g = groep.get(k) ?? { net: l.soort === "gas" ? "gas" : "sanitair", m: 0, bochten: 0 };
    g.m += l.lengte; g.bochten += Math.max(0, l.pad.length - 2) + 1;
    groep.set(k, g);
  }
  for (const [k, g] of groep) {
    uit.push({ net: g.net, omschrijving: `${k[0]!.toUpperCase()}${k.slice(1)} (+10 %)`, eenheid: "m", hoeveelheid: Math.ceil((g.m * 1.1) / 1000) });
    uit.push({ net: g.net, omschrijving: `Bochten / koppelingen voor ${k} (schatting)`, eenheid: "st", hoeveelheid: g.bochten });
  }
  const toestelKranen = ld.filter((l) => l.soort === "koud" || l.soort === "warm").length;
  if (toestelKranen) uit.push({ net: "sanitair", omschrijving: "Stopkraan per aansluiting", eenheid: "st", hoeveelheid: toestelKranen });
  const gasKranen = ld.filter((l) => l.soort === "gas").length;
  if (gasKranen) uit.push({ net: "gas", omschrijving: "Gasafsluitkraan per toestel (+ hoofdkraan aan de meter)", eenheid: "st", hoeveelheid: gasKranen + 1 });
  return uit;
}

// ---------------------------------------------------------------------------
// tekening: symbolen en leidingen als SVG (in plancoördinaten via t)

export const NET_KLEUR: Record<LeidingSoort | "elektriciteit", string> = {
  koud: "#2563eb",
  warm: "#dc2626",
  afvoer: "#78716c",
  gas: "#ca8a04",
  elektriciteit: "#7c3aed",
};

/** SVG-elementen voor installaties (symbolen + leidingen). `t` zet plan-mm om naar SVG-coördinaten. */
export function installatiesSVG(p: Project, v: Verdieping, t: (q: Punt) => { x: number; y: number }, opties: { netten?: Net[]; geselecteerd?: string; interactief?: boolean; grootte?: number } = {}): string[] {
  const netten = new Set(opties.netten ?? ["elektriciteit", "sanitair", "gas"]);
  const g = opties.grootte ?? 160;
  const el: string[] = [];
  for (const l of leidingen(p)) {
    if (l.verdiepingId !== v.id) continue;
    if (!netten.has(l.soort === "gas" ? "gas" : "sanitair")) continue;
    const pts = l.pad.map((q) => { const r = t(q); return `${r.x.toFixed(0)},${r.y.toFixed(0)}`; }).join(" ");
    const verschil = l.soort === "warm" ? 30 : l.soort === "koud" ? -30 : 0; // naast elkaar zichtbaar
    el.push(`<polyline points="${pts}" fill="none" stroke="${NET_KLEUR[l.soort]}" stroke-width="${l.soort === "afvoer" ? 35 : 22}"${l.soort === "afvoer" ? ' stroke-dasharray="90 50"' : ""} transform="translate(${verschil} ${verschil})" pointer-events="none" opacity="0.9"/>`);
    if (l.soort === "gas") {
      // afsluitkraan vlak bij het toestel: twee driehoekjes
      const eind = t(l.pad[l.pad.length - 1]!), voor = t(l.pad[Math.max(0, l.pad.length - 2)]!);
      const L = Math.hypot(eind.x - voor.x, eind.y - voor.y) || 1;
      const u = { x: (eind.x - voor.x) / L, y: (eind.y - voor.y) / L }, n = { x: -u.y, y: u.x };
      const k = { x: eind.x - u.x * g * 1.4, y: eind.y - u.y * g * 1.4 }, s = g * 0.45;
      const P = (a: number, b: number) => `${(k.x + u.x * a + n.x * b).toFixed(0)},${(k.y + u.y * a + n.y * b).toFixed(0)}`;
      el.push(`<polygon points="${P(-s, -s)} ${P(-s, s)} ${P(s, -s)} ${P(s, s)}" fill="${NET_KLEUR.gas}" stroke="#713f12" stroke-width="8" pointer-events="none"/>`);
    }
  }
  if (netten.has("elektriciteit")) {
    // kringcode bij elk elektrisch punt
    const code = new Map<string, string>();
    for (const k of kringenVoorstel(p)) for (const x of k.punten) code.set(x.punt.id, k.code);
    for (const x of v.installaties.filter((y) => y.net === "elektriciteit")) el.push(...symbool(x, t(x.positie), g, opties, code.get(x.id)));
  }
  for (const x of v.installaties.filter((y) => y.net !== "elektriciteit" && netten.has(y.net))) el.push(...symbool(x, t(x.positie), g, opties));
  return el;
}

function symbool(x: InstallatiePunt, c: { x: number; y: number }, g: number, o: { geselecteerd?: string; interactief?: boolean }, kring?: string): string[] {
  const d = DEF.get(x.soort);
  const sel = x.id === o.geselecteerd;
  const kleur = x.net === "elektriciteit" ? NET_KLEUR.elektriciteit : x.net === "gas" ? NET_KLEUR.gas : "#0369a1";
  const attr = o.interactief ? ` data-installatie="${x.id}" style="cursor:pointer"` : ' pointer-events="none"';
  const X = c.x.toFixed(0), Y = c.y.toFixed(0);
  const el: string[] = [];
  if (sel) el.push(`<circle cx="${X}" cy="${Y}" r="${(g * 1.3).toFixed(0)}" fill="#fde68a" stroke="#b45309" stroke-width="20" pointer-events="none"/>`);
  const s = d?.kring;
  if (s === "licht") {
    el.push(`<g${attr}><circle cx="${X}" cy="${Y}" r="${g}" fill="#fff" stroke="${kleur}" stroke-width="18"/><line x1="${c.x - g * 0.7}" y1="${c.y - g * 0.7}" x2="${c.x + g * 0.7}" y2="${c.y + g * 0.7}" stroke="${kleur}" stroke-width="18"/><line x1="${c.x - g * 0.7}" y1="${c.y + g * 0.7}" x2="${c.x + g * 0.7}" y2="${c.y - g * 0.7}" stroke="${kleur}" stroke-width="18"/></g>`);
  } else if (s === "stop") {
    el.push(`<g${attr}><path d="M ${c.x - g} ${c.y} A ${g} ${g} 0 0 1 ${c.x + g} ${c.y} Z" fill="#fff" stroke="${kleur}" stroke-width="18"/><line x1="${c.x}" y1="${c.y}" x2="${c.x}" y2="${c.y + g * 0.9}" stroke="${kleur}" stroke-width="18"/>${x.soort === "stopcontact-dubbel" ? `<text x="${X}" y="${c.y - g * 0.25}" font-size="${g * 0.8}" text-anchor="middle" fill="${kleur}" font-weight="700">2</text>` : ""}</g>`);
  } else if (s === "schakelaar") {
    el.push(`<g${attr}><circle cx="${X}" cy="${Y}" r="${g * 0.6}" fill="#fff" stroke="${kleur}" stroke-width="18"/><line x1="${c.x + g * 0.4}" y1="${c.y - g * 0.4}" x2="${c.x + g * 1.2}" y2="${c.y - g * 1.2}" stroke="${kleur}" stroke-width="18"/></g>`);
  } else if (s === "bord") {
    el.push(`<g${attr}><rect x="${c.x - g * 1.2}" y="${c.y - g * 0.7}" width="${g * 2.4}" height="${g * 1.4}" fill="#fff" stroke="${kleur}" stroke-width="18"/><rect x="${c.x - g * 1.2}" y="${c.y - g * 0.7}" width="${g * 1.2}" height="${g * 1.4}" fill="${kleur}"/></g>`);
  } else {
    const code = d?.code ?? "?";
    const w = Math.max(g * 2, code.length * g * 0.75 + g * 0.6);
    el.push(`<g${attr}><rect x="${(c.x - w / 2).toFixed(0)}" y="${(c.y - g * 0.75).toFixed(0)}" width="${w.toFixed(0)}" height="${(g * 1.5).toFixed(0)}" rx="${(g * 0.3).toFixed(0)}" fill="${x.net === "gas" ? "#fef9c3" : "#fff"}" stroke="${kleur}" stroke-width="18"/><text x="${X}" y="${Y}" font-size="${(g * 0.9).toFixed(0)}" text-anchor="middle" dominant-baseline="central" fill="${kleur}" font-weight="700">${code}</text></g>`);
  }
  if (kring) el.push(`<text x="${(c.x + g * 1.15).toFixed(0)}" y="${(c.y + g * 1.3).toFixed(0)}" font-size="${(g * 0.8).toFixed(0)}" fill="${kleur}" pointer-events="none" paint-order="stroke" stroke="#fff" stroke-width="30">${kring}</text>`);
  return el;
}

/**
 * Vereenvoudigd eendraadschema als SVG (eigen tekening, niet de officiële
 * symbolen): hoofdschakelaar → differentieel 300 mA → kringen; kringen op
 * 30 mA in een eigen groep. Per kring: automaat, kabel en de punten.
 */
export function eendraadschemaSVG(p: Project): string {
  const kringen = kringenVoorstel(p);
  const rijH = 70, x0 = 40;
  const el: string[] = [];
  let y = 40;
  const tekst = (x: number, yy: number, s: string, size = 14, kleur = "#1c1917", vet = false) =>
    el.push(`<text x="${x}" y="${yy}" font-size="${size}" fill="${kleur}"${vet ? ' font-weight="700"' : ""}>${esc(s)}</text>`);
  tekst(x0, y, "Eendraadschema (voorstel, vereenvoudigd)", 18, "#1c1917", true);
  y += 22;
  tekst(x0, y, "Niet het officiële schema volgens het AREI: de installateur tekent dat en laat het keuren.", 12, "#57534e");
  y += 34;
  el.push(`<rect x="${x0}" y="${y}" width="150" height="40" fill="#fff" stroke="#1c1917" stroke-width="2"/>`);
  tekst(x0 + 10, y + 25, "Teller + hoofdschakelaar", 12);
  const railX = x0 + 75;
  let yRail = y + 40;
  const groepen: Array<[30 | 300, Kring[]]> = [[300, kringen.filter((k) => k.differentieel === 300)], [30, kringen.filter((k) => k.differentieel === 30)]];
  for (const [mA, ks] of groepen) {
    if (!ks.length) continue;
    const yD = yRail + 30;
    el.push(`<line x1="${railX}" y1="${yRail}" x2="${railX}" y2="${yD}" stroke="#1c1917" stroke-width="2"/>`);
    el.push(`<rect x="${railX - 40}" y="${yD}" width="80" height="34" fill="#ede9fe" stroke="#7c3aed" stroke-width="2"/>`);
    tekst(railX - 34, yD + 22, `Diff. ${mA} mA`, 12, "#5b21b6", true);
    let yk = yD + 34 + 20;
    el.push(`<line x1="${railX}" y1="${yD + 34}" x2="${railX}" y2="${yk + (ks.length - 1) * rijH}" stroke="#1c1917" stroke-width="2"/>`);
    for (const k of ks) {
      el.push(`<line x1="${railX}" y1="${yk}" x2="${railX + 60}" y2="${yk}" stroke="#1c1917" stroke-width="2"/>`);
      el.push(`<rect x="${railX + 60}" y="${yk - 16}" width="70" height="32" fill="#fff" stroke="#1c1917" stroke-width="2"/>`);
      tekst(railX + 66, yk + 5, `C ${k.automaat} A`, 12, "#1c1917", true);
      el.push(`<line x1="${railX + 130}" y1="${yk}" x2="${railX + 180}" y2="${yk}" stroke="#1c1917" stroke-width="2"/>`);
      tekst(railX + 186, yk - 4, `${k.code}  ${k.omschrijving}`, 13, "#1c1917", true);
      const punten = k.punten.map((x) => `${DEF.get(x.punt.soort)?.code ?? x.punt.soort}${x.ruimte ? ` (${x.ruimte})` : ""}`).join(", ");
      tekst(railX + 186, yk + 14, `3G${String(k.kabel).replace(".", ",")} mm² · ± ${String(k.kabelLengte).replace(".", ",")} m · ${k.punten.length} punten: ${punten.length > 90 ? punten.slice(0, 88) + "…" : punten}`, 11, "#57534e");
      yk += rijH;
    }
    yRail = yk - rijH + 10;
    // tweede groep hangt aan de hoofdrail
    el.push(`<line x1="${railX}" y1="${y + 40}" x2="${railX}" y2="${yRail}" stroke="#1c1917" stroke-width="2" stroke-dasharray="4 4"/>`);
  }
  if (!kringen.length) tekst(x0, y + 90, "Nog geen elektrische punten op het plan.", 13, "#57534e");
  const H = Math.max(200, yRail + 60);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 ${H}" font-family="Helvetica, Arial, sans-serif" style="background:#fff">\n${el.join("\n")}\n</svg>\n`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
