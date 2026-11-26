/**
 * Ontwerp: nieuwe toestand naast de bestaande.
 *
 * - Per muur een toestand: bestaand, afbreken (geel) of nieuw (rood) —
 *   de gangbare kleuren op Belgische verbouwingsplannen.
 * - Per opening: bestaand, nieuw (nieuwe opening in een bestaande muur) of
 *   dicht (bestaande opening dichtmaken).
 * - Doorsneden langs een snijlijn en gevelaanzichten, als eenvoudige
 *   lijntekening (Tekening) die naar SVG en PDF kan.
 *
 * De app ontwerpt niet in de plaats van de architect: waar de wet een
 * architect vraagt (vergunningsplichtige werken, stabiliteit) waarschuwt ze.
 */
import { muurLengte, muurVorm, planMidden, puntLangsMuur, richting, zwaartepunt } from "./geometrie.ts";
import { dakInAanzicht, dakInDoorsnede, trapInDoorsnede } from "./architect.ts";
import type { Muur, MuurToestand, Opening, OpeningToestand, Project, Punt, Verdieping } from "./schema.ts";

export const TOESTAND_KLEUR = { bestaand: "#292524", afbreken: "#facc15", nieuw: "#dc2626" } as const;

export const ONTWERP_DISCLAIMER =
  "Schetsontwerp ter voorbereiding, geen bouwplan voor een omgevingsvergunning. Muren afbreken of nieuwe openingen in dragende muren: stabiliteitsstudie door een ingenieur. Vergunningsplicht en architectenplicht na te kijken bij de gemeente.";

export const muurToestand = (m: Muur): MuurToestand => m.toestand ?? "bestaand";
export const openingToestand = (o: Opening): OpeningToestand => o.toestand ?? "bestaand";

export function zetMuurToestand(v: Verdieping, id: string, t: MuurToestand): Verdieping {
  return { ...v, muren: v.muren.map((m) => (m.id === id ? { ...m, toestand: t === "bestaand" ? undefined : t } : m)) };
}

export function zetOpeningToestand(v: Verdieping, id: string, t: OpeningToestand): Verdieping {
  return { ...v, openingen: v.openingen.map((o) => (o.id === id ? { ...o, toestand: t === "bestaand" ? undefined : t } : o)) };
}

/** Verdieping zoals ze is (bestaand) of wordt (nieuw). */
export function verdiepingInToestand(v: Verdieping, welke: "bestaand" | "nieuw"): Verdieping {
  const muren = v.muren.filter((m) => (welke === "bestaand" ? muurToestand(m) !== "nieuw" : muurToestand(m) !== "afbreken"));
  const ids = new Set(muren.map((m) => m.id));
  const openingen = v.openingen.filter((o) => ids.has(o.muurId) && (welke === "bestaand" ? openingToestand(o) !== "nieuw" : openingToestand(o) !== "dicht"));
  const bron = welke === "nieuw" && v.ruimtesNieuw ? v.ruimtesNieuw : v.ruimtes;
  return { ...v, muren, openingen, ruimtes: bron.map((r) => ({ ...r, muurIds: r.muurIds.filter((id) => ids.has(id)) })) };
}

export function heeftOntwerp(p: Project): boolean {
  return p.verdiepingen.some((v) => v.muren.some((m) => m.toestand && m.toestand !== "bestaand") || v.openingen.some((o) => o.toestand && o.toestand !== "bestaand")) || p.doorsneden.length > 0;
}

// ---------------------------------------------------------------------------
// nieuwe muur tekenen

/**
 * Een getikt punt "vangen": op 10 mm afronden, en dicht bij een bestaande
 * muur (binnen `vang` mm) op het dichtste muurvlak leggen. Zo sluit een nieuwe
 * binnenmuur netjes aan.
 */
export function vangPunt(v: Verdieping, p: Punt, vang = 250): Punt {
  let beste: Punt | null = null, d = vang;
  for (const m of v.muren) {
    const L = muurLengte(m);
    if (L < 1) continue;
    const u = richting(m), n = { x: -u.y, y: u.x };
    const t = (p.x - m.start.x) * u.x + (p.y - m.start.y) * u.y;
    if (t < -m.dikte || t > L + m.dikte) continue;
    const s = (p.x - m.start.x) * n.x + (p.y - m.start.y) * n.y;
    const kant = s >= 0 ? 1 : -1;
    const afst = Math.abs(Math.abs(s) - m.dikte / 2);
    if (afst < d) {
      d = afst;
      const tt = Math.max(0, Math.min(L, t));
      beste = { x: m.start.x + u.x * tt + n.x * kant * (m.dikte / 2), y: m.start.y + u.y * tt + n.y * kant * (m.dikte / 2) };
    }
  }
  const q = beste ?? p;
  return { x: Math.round(q.x / 10) * 10, y: Math.round(q.y / 10) * 10 };
}

/** Bijna horizontaal of verticaal (< 3°) → exact. Het eerste punt blijft. */
export function maakHaaks(a: Punt, b: Punt): Punt {
  const g = Math.abs((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);
  if (Math.min(g, 180 - g) < 3) return { x: b.x, y: a.y };
  if (Math.abs(90 - g) < 3) return { x: a.x, y: b.y };
  return b;
}

export function voegNieuweMuurToe(v: Verdieping, a: Punt, b: Punt, dikte = 100, hoogte?: number): { verdieping: Verdieping; id: string } {
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  if (L < 300) throw new Error("Een nieuwe muur moet minstens 30 cm lang zijn.");
  if (!(dikte > 0)) throw new Error("De muurdikte moet groter dan 0 zijn.");
  // het binnenvlak waarop een uiteinde gevangen is: de hartlijn een halve dikte verder laten lopen tot in de bestaande muur is niet nodig;
  // de nieuwe muur stopt tegen het vlak (zoals een binnenmuur die tegen een bestaande muur komt).
  const bestaand = new Set(v.muren.map((m) => m.id));
  let n = 1;
  while (bestaand.has(`m-nieuw${n}@${v.id}`)) n++;
  const id = `m-nieuw${n}@${v.id}`;
  const h = Math.round(hoogte ?? Math.max(2400, ...v.ruimtes.map((r) => r.plafondhoogte)));
  const muur: Muur = { id, start: { x: Math.round(a.x), y: Math.round(a.y) }, eind: { x: Math.round(b.x), y: Math.round(b.y) }, dikte: Math.round(dikte), hoogte: h, dragend: "niet-dragend", bron: { methode: "manueel" }, toestand: "nieuw" };
  return { verdieping: { ...v, muren: [...v.muren, muur] }, id };
}

/** Een nieuwe muur verwijderen; een bestaande muur kan je alleen op "afbreken" zetten. */
export function verwijderNieuweMuur(v: Verdieping, id: string): Verdieping {
  const m = v.muren.find((x) => x.id === id);
  if (!m || muurToestand(m) !== "nieuw") throw new Error("Alleen nieuwe muren kan je verwijderen. Een bestaande muur zet je op 'afbreken'.");
  return { ...v, muren: v.muren.filter((x) => x.id !== id), openingen: v.openingen.filter((o) => o.muurId !== id) };
}

// ---------------------------------------------------------------------------
// waarschuwingen

export interface OntwerpWaarschuwing { verdieping: string; tekst: string; muurId?: string }

export function ontwerpWaarschuwingen(p: Project): OntwerpWaarschuwing[] {
  const uit: OntwerpWaarschuwing[] = [];
  for (const v of p.verdiepingen) {
    const naam = (m: Muur) => `muur ${m.id.split("@")[0]} (${Math.round(muurLengte(m))} mm)`;
    for (const m of v.muren) {
      if (muurToestand(m) === "afbreken" && m.dragend !== "niet-dragend")
        uit.push({ verdieping: v.naam, muurId: m.id, tekst: `${naam(m)} afbreken: ${m.dragend === "bevestigd" ? "dragende muur" : "dragend of niet is niet vastgesteld"}. Stabiliteitsstudie door een ingenieur nodig (ligger, kolommen, fundering); meestal vergunningsplichtig met architect.` });
    }
    for (const o of v.openingen) {
      const m = v.muren.find((x) => x.id === o.muurId);
      if (!m) continue;
      if (openingToestand(o) === "nieuw" && muurToestand(m) !== "nieuw" && m.dragend !== "niet-dragend")
        uit.push({ verdieping: v.naam, muurId: m.id, tekst: `Nieuwe opening van ${o.breedte} mm in ${naam(m)}: latei of ligger nodig${m.dragend === "bevestigd" ? " (dragende muur)" : " (dragend niet vastgesteld)"}. Voordimensionering: zie liggers; aftekenen door een ingenieur.` });
    }
  }
  if (uit.length) uit.push({ verdieping: "", tekst: "Werken aan de stabiliteit zijn in de regel vergunningsplichtig en vragen een architect. Na te kijken bij de gemeente vóór de werken." });
  return uit;
}

// ---------------------------------------------------------------------------
// eenvoudige lijntekening (doorsnede, aanzicht) → SVG en PDF

export type TekenEl =
  | { t: "rect"; x: number; y: number; b: number; h: number; vul?: string; lijn?: string; dikte?: number; streep?: boolean; data?: string }
  | { t: "lijn"; a: Punt; b: Punt; lijn: string; dikte: number; streep?: boolean }
  | { t: "tekst"; p: Punt; s: string; grootte: number; kleur?: string; anker?: "start" | "middle" | "end"; vet?: boolean }
  | { t: "veelhoek"; punten: Punt[]; vul?: string; lijn?: string; dikte?: number };

export interface Tekening { titel: string; elementen: TekenEl[]; minX: number; maxX: number; minY: number; maxY: number }

function kader(titel: string, el: TekenEl[], marge = 600): Tekening {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const neem = (x: number, y: number) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); };
  for (const e of el) {
    if (e.t === "rect") { neem(e.x, e.y); neem(e.x + e.b, e.y + e.h); }
    else if (e.t === "lijn") { neem(e.a.x, e.a.y); neem(e.b.x, e.b.y); }
    else if (e.t === "veelhoek") { for (const q of e.punten) neem(q.x, q.y); }
    else { neem(e.p.x, e.p.y); neem(e.p.x, e.p.y + e.grootte); }
  }
  if (!Number.isFinite(minX)) { minX = 0; maxX = 1000; minY = 0; maxY = 1000; }
  return { titel, elementen: el, minX: minX - marge, maxX: maxX + marge, minY: minY - marge, maxY: maxY + marge };
}

export function tekeningNaarSVG(t: Tekening): string {
  const X = (x: number) => (x - t.minX).toFixed(0), Y = (y: number) => (t.maxY - y).toFixed(0);
  const out = t.elementen.map((e) => {
    if (e.t === "rect") return `<rect x="${X(e.x)}" y="${Y(e.y + e.h)}" width="${e.b.toFixed(0)}" height="${e.h.toFixed(0)}" fill="${e.vul ?? "none"}" stroke="${e.lijn ?? "none"}" stroke-width="${e.dikte ?? 10}"${e.streep ? ' stroke-dasharray="60 40"' : ""}${e.data ? ` data-kast="${esc(e.data)}" style="cursor:pointer"` : ""}/>`;
    if (e.t === "veelhoek") return `<polygon pointer-events="none" points="${e.punten.map((q) => `${X(q.x)},${Y(q.y)}`).join(" ")}" fill="${e.vul ?? "none"}" stroke="${e.lijn ?? "none"}" stroke-width="${e.dikte ?? 10}"/>`;
    if (e.t === "lijn") return `<line pointer-events="none" x1="${X(e.a.x)}" y1="${Y(e.a.y)}" x2="${X(e.b.x)}" y2="${Y(e.b.y)}" stroke="${e.lijn}" stroke-width="${e.dikte}"${e.streep ? ' stroke-dasharray="60 40"' : ""}/>`;
    return `<text pointer-events="none" x="${X(e.p.x)}" y="${Y(e.p.y)}" font-size="${e.grootte}" text-anchor="${e.anker ?? "start"}" fill="${e.kleur ?? "#1c1917"}"${e.vet ? ' font-weight="700"' : ""}>${esc(e.s)}</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${(t.maxX - t.minX).toFixed(0)} ${(t.maxY - t.minY).toFixed(0)}" font-family="Helvetica, Arial, sans-serif" style="background:#fff">\n${out.join("\n")}\n</svg>\n`;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const peilTekst = (mm: number) => `${mm >= 0 ? "+" : "−"}${(Math.abs(mm) / 1000).toFixed(2).replace(".", ",")}`;

/** Snijpunten (parameter t ∈ [0,1] op AB) van segment AB met een veelhoek; gesorteerd. */
function snijParams(a: Punt, b: Punt, poly: Punt[]): number[] {
  const d = { x: b.x - a.x, y: b.y - a.y };
  const ts: number[] = [];
  for (let k = 0; k < poly.length; k++) {
    const p = poly[k]!, q = poly[(k + 1) % poly.length]!;
    const e = { x: q.x - p.x, y: q.y - p.y };
    const den = d.x * e.y - d.y * e.x;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((p.x - a.x) * e.y - (p.y - a.y) * e.x) / den;
    const s = ((p.x - a.x) * d.y - (p.y - a.y) * d.x) / den;
    if (t >= -1e-9 && t <= 1 + 1e-9 && s >= -1e-9 && s <= 1 + 1e-9) ts.push(Math.max(0, Math.min(1, t)));
  }
  ts.sort((x, y) => x - y);
  return ts.filter((t, i) => i === 0 || t - ts[i - 1]! > 1e-7);
}

const binnen = (p: Punt, c: Punt[]) => {
  let in_ = false;
  for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
    const a = c[i]!, b = c[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) in_ = !in_;
  }
  return in_;
};

/** Intervallen [t0, t1] (in mm vanaf A) van AB binnen de veelhoek. */
function binnenIntervallen(a: Punt, b: Punt, poly: Punt[]): Array<[number, number]> {
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  const ts = [0, ...snijParams(a, b, poly), 1];
  const uit: Array<[number, number]> = [];
  for (let i = 0; i + 1 < ts.length; i++) {
    const m = (ts[i]! + ts[i + 1]!) / 2;
    if (ts[i + 1]! - ts[i]! > 1e-6 && binnen({ x: a.x + (b.x - a.x) * m, y: a.y + (b.y - a.y) * m }, poly)) uit.push([ts[i]! * L, ts[i + 1]! * L]);
  }
  return uit;
}

/** Bovenkant van de verdieping onder v (hoogste muur), of v.peil als er geen is. */
function onderTop(p: Project, v: Verdieping): number {
  const lager = p.verdiepingen.filter((x) => x.peil < v.peil).sort((a, b) => b.peil - a.peil)[0];
  if (!lager || !lager.muren.length) return v.peil;
  return Math.min(v.peil, lager.peil + Math.max(...lager.muren.map((m) => m.hoogte)));
}

const ZWART = "#1c1917", GRIJS = "#78716c", VLOER = "#a8a29e", GLAS = "#e0f2fe";

/**
 * Doorsnede langs AB (alle verdiepingen). x = afstand vanaf A (mm), y = hoogte (peil + mm).
 * Gesneden muren donker (geel = afbreken, rood = nieuw in de verbouwingsweergave),
 * vloeren en plafonds per ruimte, openingen als gat. Wat achter de snede zichtbaar is, wordt (nog) niet getekend.
 */
export function doorsnede(p: Project, a: Punt, b: Punt, o: { naam?: string; toestand?: "bestaand" | "nieuw" | "verbouwing" } = {}): Tekening {
  const welke = o.toestand ?? "verbouwing";
  const el: TekenEl[] = [];
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  if (L < 1) return kader(o.naam ?? "Doorsnede", el);
  const u = { x: (b.x - a.x) / L, y: (b.y - a.y) / L };
  const verd = [...p.verdiepingen].sort((x, y) => x.peil - y.peil);
  let laagste = Infinity, hoogste = -Infinity;
  verd.forEach((v0, i) => {
    const v = welke === "verbouwing" ? v0 : verdiepingInToestand(v0, welke);
    const boven = verd[i + 1];
    // ruimtes: vloer, plafond en vloerplaat naar de verdieping erboven
    for (const r of v.ruimtes) {
      for (const [t0, t1] of binnenIntervallen(a, b, r.contour)) {
        const plafond = v.peil + r.plafondhoogte;
        el.push({ t: "lijn", a: { x: t0, y: v.peil }, b: { x: t1, y: v.peil }, lijn: ZWART, dikte: 14 });
        el.push({ t: "lijn", a: { x: t0, y: plafond }, b: { x: t1, y: plafond }, lijn: ZWART, dikte: 14 });
        if (boven && boven.peil > plafond + 20) el.push({ t: "rect", x: t0, y: plafond, b: t1 - t0, h: boven.peil - plafond, vul: VLOER, lijn: ZWART, dikte: 8 });
        if (t1 - t0 > 900) {
          el.push({ t: "tekst", p: { x: (t0 + t1) / 2, y: v.peil + r.plafondhoogte / 2 + 60 }, s: r.naam, grootte: 160, anker: "middle", vet: true });
          el.push({ t: "tekst", p: { x: (t0 + t1) / 2, y: v.peil + r.plafondhoogte / 2 - 180 }, s: `h ${r.plafondhoogte}`, grootte: 130, anker: "middle", kleur: GRIJS });
        }
        laagste = Math.min(laagste, v.peil); hoogste = Math.max(hoogste, plafond);
      }
    }
    // muren
    for (const m of v.muren) {
      const iv = binnenIntervallen(a, b, muurVorm(m, v.muren));
      if (!iv.length) continue;
      const t = muurToestand(m);
      const vul = welke === "verbouwing" ? TOESTAND_KLEUR[t] : ZWART;
      for (const [t0, t1] of iv) {
        // waar snijdt de lijn de hartlijn (langs de muur gemeten)?
        const mid = { x: a.x + u.x * ((t0 + t1) / 2), y: a.y + u.y * ((t0 + t1) / 2) };
        const mu = richting(m);
        const langs = (mid.x - m.start.x) * mu.x + (mid.y - m.start.y) * mu.y;
        const gat = v.openingen.find((x) => x.muurId === m.id && langs >= x.offset && langs <= x.offset + x.breedte);
        const onder = onderTop(p, v0) - v.peil; // ≤ 0: muur loopt door tot op de verdieping eronder (vloerdikte)
        const stukken: Array<[number, number]> = gat ? [[onder, gat.borstwering], [gat.borstwering + gat.hoogte, m.hoogte]] : [[onder, m.hoogte]];
        for (const [z0, z1] of stukken) if (z1 - z0 > 1) el.push({ t: "rect", x: t0, y: v.peil + z0, b: t1 - t0, h: z1 - z0, vul, lijn: ZWART, dikte: 10, streep: t === "afbreken" && welke === "verbouwing" });
        if (gat) {
          const kl = welke === "verbouwing" && openingToestand(gat) !== "bestaand" ? TOESTAND_KLEUR[openingToestand(gat) === "nieuw" ? "nieuw" : "afbreken"] : GRIJS;
          el.push({ t: "rect", x: t0, y: v.peil + gat.borstwering, b: t1 - t0, h: gat.hoogte, vul: gat.soort === "raam" ? GLAS : "#fff", lijn: kl, dikte: 8 });
        }
        laagste = Math.min(laagste, v.peil); hoogste = Math.max(hoogste, v.peil + m.hoogte);
      }
    }
    // peil links
    el.push({ t: "lijn", a: { x: -700, y: v.peil }, b: { x: -200, y: v.peil }, lijn: GRIJS, dikte: 8 });
    el.push({ t: "tekst", p: { x: -720, y: v.peil + 40 }, s: `${peilTekst(v.peil)} ${v.naam}`, grootte: 130, anker: "end", kleur: GRIJS });
  });
  // trappen en dak
  verd.forEach((v0, i2) => {
    const H = (verd[i2 + 1]?.peil ?? v0.peil + 2800) - v0.peil;
    for (const t of v0.trappen ?? []) el.push(...trapInDoorsnede(t, v0, H, a, b));
  });
  const dak = dakInDoorsnede(p, a, b);
  el.push(...dak);
  for (const e of dak) if (e.t === "veelhoek") hoogste = Math.max(hoogste, ...e.punten.map((q) => q.y));
  if (Number.isFinite(laagste)) {
    const mv = p.terrein?.maaiveld;
    el.unshift({ t: "lijn", a: { x: -300, y: laagste }, b: { x: L + 300, y: laagste }, lijn: ZWART, dikte: 24 });
    if (mv !== undefined) {
      el.push({ t: "lijn", a: { x: -800, y: mv }, b: { x: L + 800, y: mv }, lijn: "#3f6212", dikte: 20, streep: true });
      el.push({ t: "tekst", p: { x: L + 820, y: mv + 40 }, s: `maaiveld ${peilTekst(mv)}`, grootte: 120, kleur: "#3f6212" });
    }
    el.push({ t: "tekst", p: { x: L / 2, y: hoogste + 300 }, s: o.naam ?? "Doorsnede", grootte: 220, anker: "middle", vet: true });
  }
  return kader(o.naam ?? "Doorsnede", el);
}

export type Zijde = "voor" | "achter" | "links" | "rechts";
export const ZIJDEN: Array<{ zijde: Zijde; naam: string }> = [
  { zijde: "voor", naam: "Voorgevel (onderkant plan)" },
  { zijde: "achter", naam: "Achtergevel (bovenkant plan)" },
  { zijde: "links", naam: "Linkergevel" },
  { zijde: "rechts", naam: "Rechtergevel" },
];

/**
 * Gevelaanzicht van een zijde: buitenmuren waarvan de buitenkant naar de
 * kijker wijst, verste eerst (wat dichterbij staat, tekent erover).
 * Daken en buitenaanleg worden niet getekend.
 */
export function aanzicht(p: Project, zijde: Zijde, o: { toestand?: "bestaand" | "nieuw" | "verbouwing" } = {}): Tekening {
  const welke = o.toestand ?? "nieuw";
  // kijkrichting k (van de kijker naar het gebouw) en de as naar rechts u
  const k = { voor: { x: 0, y: 1 }, achter: { x: 0, y: -1 }, links: { x: 1, y: 0 }, rechts: { x: -1, y: 0 } }[zijde];
  const u = { x: k.y, y: -k.x };
  const el: TekenEl[] = [];
  type Vlak = { diepte: number; teken: () => void };
  const vlakken: Vlak[] = [];
  let laagste = Infinity, hoogste = -Infinity, links = Infinity, rechts = -Infinity;
  for (const v0 of p.verdiepingen) {
    const v = welke === "verbouwing" ? v0 : verdiepingInToestand(v0, welke);
    const midden = planMidden(v);
    for (const m of v.muren) {
      const buren = v.ruimtes.filter((r) => r.muurIds.includes(m.id));
      if (buren.length >= 2) continue; // tussenmuur
      const mu = richting(m);
      let n = { x: -mu.y, y: mu.x };
      const ref = buren[0] ? zwaartepunt(buren[0].contour) : midden;
      const c = { x: (m.start.x + m.eind.x) / 2, y: (m.start.y + m.eind.y) / 2 };
      if ((ref.x - c.x) * n.x + (ref.y - c.y) * n.y > 0) n = { x: -n.x, y: -n.y }; // naar buiten
      const naarKijker = -(n.x * k.x + n.y * k.y);
      if (naarKijker < 0.3) continue;
      const vorm = muurVorm(m, v.muren);
      const s = vorm.map((q) => q.x * u.x + q.y * u.y);
      const x0 = Math.min(...s), x1 = Math.max(...s);
      const diepte = Math.min(...vorm.map((q) => q.x * k.x + q.y * k.y));
      const t = muurToestand(m);
      const peil = v.peil;
      const onder = onderTop(p, v0);
      laagste = Math.min(laagste, peil); hoogste = Math.max(hoogste, peil + m.hoogte); links = Math.min(links, x0); rechts = Math.max(rechts, x1);
      vlakken.push({
        diepte,
        teken: () => {
          el.push({ t: "rect", x: x0, y: onder, b: x1 - x0, h: m.hoogte + (peil - onder), vul: "#f5f5f4", lijn: welke === "verbouwing" && t !== "bestaand" ? TOESTAND_KLEUR[t] : ZWART, dikte: welke === "verbouwing" && t !== "bestaand" ? 30 : 14, streep: welke === "verbouwing" && t === "afbreken" });
          for (const op of v.openingen.filter((x) => x.muurId === m.id)) {
            const pa = puntLangsMuur(m, op.offset), pb = puntLangsMuur(m, op.offset + op.breedte);
            const ox0 = Math.min(pa.x * u.x + pa.y * u.y, pb.x * u.x + pb.y * u.y), ox1 = Math.max(pa.x * u.x + pa.y * u.y, pb.x * u.x + pb.y * u.y);
            const ot = openingToestand(op);
            const kl = welke === "verbouwing" && ot !== "bestaand" ? TOESTAND_KLEUR[ot === "nieuw" ? "nieuw" : "afbreken"] : ZWART;
            const y0 = peil + op.borstwering;
            el.push({ t: "rect", x: ox0, y: y0, b: ox1 - ox0, h: op.hoogte, vul: op.soort === "raam" ? GLAS : "#fff", lijn: kl, dikte: ot !== "bestaand" && welke === "verbouwing" ? 24 : 12 });
            if (op.soort === "raam") {
              el.push({ t: "lijn", a: { x: (ox0 + ox1) / 2, y: y0 }, b: { x: (ox0 + ox1) / 2, y: y0 + op.hoogte }, lijn: kl, dikte: 8 });
            } else if (op.soort === "deur") {
              el.push({ t: "lijn", a: { x: ox1 - 120, y: y0 + 1000 }, b: { x: ox1 - 120, y: y0 + 1100 }, lijn: kl, dikte: 16 });
            }
          }
        },
      });
    }
  }
  vlakken.sort((x, y) => y.diepte - x.diepte).forEach((v) => v.teken());
  const dak = dakInAanzicht(p, u, k);
  el.push(...dak);
  for (const e of dak) if (e.t === "veelhoek") hoogste = Math.max(hoogste, ...e.punten.map((q) => q.y));
  const mat = p.gevelmaterialen?.[zijde];
  if (mat && Number.isFinite(laagste)) el.push({ t: "tekst", p: { x: (links + rechts) / 2, y: laagste + 250 }, s: `Gevel: ${mat}`, grootte: 140, anker: "middle", kleur: "#1c1917" });
  if (p.dak?.materiaal && dak.length) el.push({ t: "tekst", p: { x: rechts + 200, y: hoogste - 200 }, s: `Dak: ${p.dak.materiaal}`, grootte: 130, kleur: "#7f1d1d" });
  if (p.terrein && Number.isFinite(laagste)) {
    el.push({ t: "lijn", a: { x: links - 1200, y: p.terrein.maaiveld }, b: { x: rechts + 1200, y: p.terrein.maaiveld }, lijn: "#3f6212", dikte: 20, streep: true });
    el.push({ t: "tekst", p: { x: rechts + 1220, y: p.terrein.maaiveld + 40 }, s: `maaiveld ${peilTekst(p.terrein.maaiveld)}`, grootte: 120, kleur: "#3f6212" });
  }
  if (Number.isFinite(laagste)) {
    el.unshift({ t: "lijn", a: { x: links - 400, y: laagste }, b: { x: rechts + 400, y: laagste }, lijn: ZWART, dikte: 24 });
    for (const v of p.verdiepingen) {
      el.push({ t: "lijn", a: { x: links - 900, y: v.peil }, b: { x: links - 450, y: v.peil }, lijn: GRIJS, dikte: 8 });
      el.push({ t: "tekst", p: { x: links - 920, y: v.peil + 40 }, s: `${peilTekst(v.peil)} ${v.naam}`, grootte: 130, anker: "end", kleur: GRIJS });
    }
    el.push({ t: "tekst", p: { x: (links + rechts) / 2, y: hoogste + 300 }, s: ZIJDEN.find((z) => z.zijde === zijde)!.naam, grootte: 220, anker: "middle", vet: true });
  }
  return kader(ZIJDEN.find((z) => z.zijde === zijde)!.naam, el);
}

/** Nieuwe opening (toestand "nieuw") in het midden van een muur; maten pas je aan in de gewone muurfiche. */
export function voegNieuweOpeningToe(v: Verdieping, muurId: string, soort: Opening["soort"] = "raam", breedte = 1000, hoogte = soort === "raam" ? 1200 : 2115): { verdieping: Verdieping; id: string } {
  const m = v.muren.find((x) => x.id === muurId);
  if (!m) throw new Error("Muur niet gevonden.");
  const L = muurLengte(m);
  const b = Math.min(breedte, Math.round(L - 2 * m.dikte));
  if (b < 300) throw new Error("Deze muur is te kort voor een nieuwe opening.");
  const borstwering = soort === "raam" ? 900 : 0;
  const h = Math.min(hoogte, m.hoogte - borstwering - 50);
  const ids = new Set(v.openingen.map((o) => o.id));
  let n = 1;
  while (ids.has(`o-nieuw${n}@${v.id}`)) n++;
  const id = `o-nieuw${n}@${v.id}`;
  const o: Opening = { id, muurId, soort, offset: Math.round((L - b) / 2), breedte: b, hoogte: h, borstwering, bron: { methode: "manueel" }, toestand: "nieuw" };
  return { verdieping: { ...v, openingen: [...v.openingen, o] }, id };
}
