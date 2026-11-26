/**
 * Inrichting: meubels en materialen, en een eenvoudig 3D-model (prisma's)
 * dat de webapp met three.js toont en als GLB kan bewaren voor een
 * renderprogramma (Blender, Twinmotion, Enscape …) voor fotorealistische beelden.
 */
import { muurLengte, muurVorm, puntLangsMuur, richting } from "./geometrie.ts";
import { muurToestand, openingToestand, verdiepingInToestand } from "./ontwerp.ts";
import type { Meubel, Project, Punt, Ruimte, Verdieping } from "./schema.ts";

export interface MeubelDef { soort: string; naam: string; breedte: number; diepte: number; hoogte: number; kleur: string; groep: string }

export const MEUBELS: MeubelDef[] = [
  { soort: "bed2", naam: "Tweepersoonsbed 160 × 200", breedte: 1600, diepte: 2100, hoogte: 500, kleur: "#e7e5e4", groep: "Slapen" },
  { soort: "bed1", naam: "Eenpersoonsbed 90 × 200", breedte: 900, diepte: 2050, hoogte: 500, kleur: "#e7e5e4", groep: "Slapen" },
  { soort: "nachtkast", naam: "Nachtkastje", breedte: 450, diepte: 400, hoogte: 500, kleur: "#a16207", groep: "Slapen" },
  { soort: "kleerkast", naam: "Kleerkast", breedte: 1500, diepte: 600, hoogte: 2200, kleur: "#d6d3d1", groep: "Slapen" },
  { soort: "zetel3", naam: "Zetel 3-zit", breedte: 2200, diepte: 950, hoogte: 850, kleur: "#64748b", groep: "Wonen" },
  { soort: "fauteuil", naam: "Fauteuil", breedte: 850, diepte: 850, hoogte: 850, kleur: "#64748b", groep: "Wonen" },
  { soort: "salontafel", naam: "Salontafel", breedte: 1100, diepte: 600, hoogte: 420, kleur: "#a16207", groep: "Wonen" },
  { soort: "tvmeubel", naam: "Tv-meubel", breedte: 1800, diepte: 450, hoogte: 500, kleur: "#44403c", groep: "Wonen" },
  { soort: "kast", naam: "Boekenkast", breedte: 1000, diepte: 350, hoogte: 2000, kleur: "#d6d3d1", groep: "Wonen" },
  { soort: "eettafel", naam: "Eettafel 6 personen", breedte: 1800, diepte: 900, hoogte: 750, kleur: "#a16207", groep: "Eten" },
  { soort: "stoel", naam: "Stoel", breedte: 450, diepte: 500, hoogte: 850, kleur: "#44403c", groep: "Eten" },
  { soort: "keuken", naam: "Keukenrij (onderkasten + werkblad)", breedte: 2400, diepte: 620, hoogte: 900, kleur: "#f5f5f4", groep: "Keuken" },
  { soort: "hoge-kast", naam: "Hoge kast / koelkast", breedte: 600, diepte: 620, hoogte: 2100, kleur: "#f5f5f4", groep: "Keuken" },
  { soort: "eiland", naam: "Keukeneiland", breedte: 1800, diepte: 900, hoogte: 900, kleur: "#f5f5f4", groep: "Keuken" },
  { soort: "bad", naam: "Bad 170 × 75", breedte: 1700, diepte: 750, hoogte: 560, kleur: "#ffffff", groep: "Badkamer" },
  { soort: "douche", naam: "Douche 90 × 90", breedte: 900, diepte: 900, hoogte: 50, kleur: "#e0f2fe", groep: "Badkamer" },
  { soort: "lavabo", naam: "Lavabomeubel", breedte: 800, diepte: 460, hoogte: 850, kleur: "#ffffff", groep: "Badkamer" },
  { soort: "toilet", naam: "Toilet", breedte: 380, diepte: 650, hoogte: 400, kleur: "#ffffff", groep: "Badkamer" },
  { soort: "bureau", naam: "Bureau", breedte: 1400, diepte: 700, hoogte: 750, kleur: "#a16207", groep: "Werken" },
  { soort: "wasmachine", naam: "Wasmachine / droogkast", breedte: 600, diepte: 620, hoogte: 850, kleur: "#ffffff", groep: "Berging" },
];

const DEF = new Map(MEUBELS.map((m) => [m.soort, m]));
export const meubelDef = (soort: string) => DEF.get(soort);

export interface Materiaal { sleutel: string; naam: string; kleur: string; soort: "vloer" | "wand" }
export const MATERIALEN: Materiaal[] = [
  { sleutel: "parket-eik", naam: "Parket eik", kleur: "#c08a53", soort: "vloer" },
  { sleutel: "parket-donker", naam: "Parket donker", kleur: "#6b4423", soort: "vloer" },
  { sleutel: "tegel-licht", naam: "Tegels lichtgrijs", kleur: "#d6d3d1", soort: "vloer" },
  { sleutel: "tegel-antraciet", naam: "Tegels antraciet", kleur: "#44403c", soort: "vloer" },
  { sleutel: "gietvloer", naam: "Gietvloer beton", kleur: "#a8a29e", soort: "vloer" },
  { sleutel: "tapijt", naam: "Tapijt beige", kleur: "#d6c7a1", soort: "vloer" },
  { sleutel: "wit", naam: "Wit geschilderd", kleur: "#fafaf9", soort: "wand" },
  { sleutel: "gebroken-wit", naam: "Gebroken wit", kleur: "#f1ede4", soort: "wand" },
  { sleutel: "lichtgrijs", naam: "Lichtgrijs", kleur: "#d4d4d4", soort: "wand" },
  { sleutel: "salie", naam: "Saliegroen", kleur: "#b5c4a8", soort: "wand" },
  { sleutel: "terracotta", naam: "Terracotta", kleur: "#c98a6b", soort: "wand" },
  { sleutel: "nachtblauw", naam: "Nachtblauw", kleur: "#2b3a55", soort: "wand" },
  { sleutel: "wandtegel", naam: "Wandtegels wit", kleur: "#f8fafc", soort: "wand" },
];
const MAT = new Map(MATERIALEN.map((m) => [m.sleutel, m]));
export const materiaal = (s?: string) => (s ? MAT.get(s) : undefined);

// ---------------------------------------------------------------------------
// meubels bewerken

export function voegMeubelToe(v: Verdieping, soort: string, positie: Punt): { verdieping: Verdieping; id: string } {
  const d = DEF.get(soort);
  if (!d) throw new Error(`Onbekend meubel '${soort}'.`);
  const ids = new Set(v.meubels.map((m) => m.id));
  let n = v.meubels.length + 1;
  while (ids.has(`mb-${n}@${v.id}`)) n++;
  const id = `mb-${n}@${v.id}`;
  const m: Meubel = { id, soort, positie: { x: Math.round(positie.x / 10) * 10, y: Math.round(positie.y / 10) * 10 }, hoek: 0, breedte: d.breedte, diepte: d.diepte, hoogte: d.hoogte };
  return { verdieping: { ...v, meubels: [...v.meubels, m] }, id };
}

export function wijzigMeubel(v: Verdieping, id: string, w: Partial<Omit<Meubel, "id" | "soort">>): Verdieping {
  return { ...v, meubels: v.meubels.map((m) => (m.id === id ? { ...m, ...w, hoek: (((w.hoek ?? m.hoek) % 360) + 360) % 360 } : m)) };
}

export function verwijderMeubel(v: Verdieping, id: string): Verdieping {
  return { ...v, meubels: v.meubels.filter((m) => m.id !== id) };
}

/** Hoekpunten van een meubel (tegen de klok in). Breedte langs de x-as bij hoek 0, de rugzijde aan de kant van +y. */
export function meubelHoeken(m: Meubel): Punt[] {
  const a = (m.hoek * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const hb = m.breedte / 2, hd = m.diepte / 2;
  return [[-hb, -hd], [hb, -hd], [hb, hd], [-hb, hd]].map(([x, y]) => ({ x: m.positie.x + x! * c - y! * s, y: m.positie.y + x! * s + y! * c }));
}

export function zetAfwerking(v: Verdieping, ruimteId: string, w: { vloer?: string; wand?: string }): Verdieping {
  return { ...v, ruimtes: v.ruimtes.map((r) => (r.id === ruimteId ? { ...r, afwerking: { ...r.afwerking, ...w } } : r)) };
}

// ---------------------------------------------------------------------------
// controles

const binnen = (p: Punt, c: Punt[]) => {
  let in_ = false;
  for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
    const a = c[i]!, b = c[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) in_ = !in_;
  }
  return in_;
};

/** Overlappen twee convexe veelhoeken? (scheidende-as-test) */
export function overlapt(a: Punt[], b: Punt[], marge = 0): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]!, q = poly[(i + 1) % poly.length]!;
      const n = { x: -(q.y - p.y), y: q.x - p.x };
      const pa = a.map((x) => x.x * n.x + x.y * n.y), pb = b.map((x) => x.x * n.x + x.y * n.y);
      const L = Math.hypot(n.x, n.y) || 1;
      if (Math.max(...pa) - marge * L <= Math.min(...pb) || Math.max(...pb) - marge * L <= Math.min(...pa)) return false;
    }
  }
  return true;
}

export interface InrichtingOpmerking { meubelId?: string; tekst: string }

/** Meubels die in een muur steken, buiten de ruimtes staan of een deur blokkeren (zone van 90 cm voor de deur). */
export function controleerInrichting(v: Verdieping): InrichtingOpmerking[] {
  const uit: InrichtingOpmerking[] = [];
  const naam = (m: Meubel) => DEF.get(m.soort)?.naam ?? m.soort;
  for (const m of v.meubels) {
    const h = meubelHoeken(m);
    const muur = v.muren.find((w) => muurToestand(w) !== "afbreken" && overlapt(h, muurVorm(w, v.muren), 5));
    if (muur) uit.push({ meubelId: m.id, tekst: `${naam(m)} steekt in een muur.` });
    else if (!h.every((p) => v.ruimtes.some((r) => binnen(p, r.contour)))) uit.push({ meubelId: m.id, tekst: `${naam(m)} staat (deels) buiten de ruimtes.` });
    for (const o of v.openingen) {
      if (o.soort !== "deur" && o.soort !== "doorgang") continue;
      if (openingToestand(o) === "dicht") continue;
      const w = v.muren.find((x) => x.id === o.muurId);
      if (!w) continue;
      const u = richting(w), n = { x: -u.y, y: u.x };
      const a = puntLangsMuur(w, o.offset), b = puntLangsMuur(w, o.offset + o.breedte);
      for (const kant of [1, -1]) {
        const d = w.dikte / 2, z = 900;
        const zone = [
          { x: a.x + n.x * kant * d, y: a.y + n.y * kant * d }, { x: b.x + n.x * kant * d, y: b.y + n.y * kant * d },
          { x: b.x + n.x * kant * (d + z), y: b.y + n.y * kant * (d + z) }, { x: a.x + n.x * kant * (d + z), y: a.y + n.y * kant * (d + z) },
        ];
        if (overlapt(h, kant === 1 ? zone : [...zone].reverse(), 5)) { uit.push({ meubelId: m.id, tekst: `${naam(m)} staat voor een ${o.soort === "deur" ? "deur" : "doorgang"} (minder dan 90 cm vrij).` }); break; }
      }
    }
  }
  return uit;
}

// ---------------------------------------------------------------------------
// 3D-model: prisma's (veelhoek in het grondvlak, van z0 tot z1)

export interface Prisma {
  soort: "muur" | "vloer" | "plafond" | "glas" | "deur" | "meubel" | "kader";
  punten: Punt[];
  z0: number;
  z1: number;
  kleur: string;
  doorzichtig?: boolean;
  /** Naam voor de export (bv. ruimte of meubel). */
  naam?: string;
}

/** Convexe veelhoek knippen tot de strook t ∈ [a, b] langs de as (oorsprong o, richting u). */
function knipStrook(poly: Punt[], o: Punt, u: Punt, a: number, b: number): Punt[] {
  const knip = (pts: Punt[], binnenF: (p: Punt) => number) => {
    const uit: Punt[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!, q = pts[(i + 1) % pts.length]!;
      const fp = binnenF(p), fq = binnenF(q);
      if (fp >= 0) uit.push(p);
      if ((fp >= 0) !== (fq >= 0)) { const t = fp / (fp - fq); uit.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }); }
    }
    return uit;
  };
  const t = (p: Punt) => (p.x - o.x) * u.x + (p.y - o.y) * u.y;
  return knip(knip(poly, (p) => t(p) - a), (p) => b - t(p));
}

/** Muurstukken rond de openingen: elke muur in horizontale banden, met gaten waar ramen en deuren zitten. */
export function muurPrismas(v: Verdieping, peil = 0, wandKleur = "#e7e5e4"): Prisma[] {
  const uit: Prisma[] = [];
  for (const m of v.muren) {
    const vorm = muurVorm(m, v.muren);
    const L = muurLengte(m), u = richting(m);
    const gaten = v.openingen.filter((o) => o.muurId === m.id);
    const niveaus = [...new Set([0, m.hoogte, ...gaten.flatMap((o) => [o.borstwering, Math.min(m.hoogte, o.borstwering + o.hoogte)])])].sort((a, b) => a - b);
    const ruimtekleur = v.ruimtes.find((r) => r.muurIds.includes(m.id))?.afwerking?.wand;
    const kleur = materiaal(ruimtekleur)?.kleur ?? wandKleur;
    for (let i = 0; i + 1 < niveaus.length; i++) {
      const z0 = niveaus[i]!, z1 = niveaus[i + 1]!;
      if (z1 - z0 < 1) continue;
      // intervallen langs de muur zonder opening in deze band
      const bezet = gaten.filter((o) => o.borstwering < z1 - 0.5 && o.borstwering + o.hoogte > z0 + 0.5).map((o) => [o.offset, o.offset + o.breedte] as [number, number]).sort((a, b) => a[0] - b[0]);
      let start = -1e6; // ver voor het begin: het verstek mee
      const vrij: Array<[number, number]> = [];
      for (const [a, b] of bezet) { if (a > start) vrij.push([start, a]); start = Math.max(start, b); }
      vrij.push([start, L + 1e6]);
      for (const [a, b] of vrij) {
        const pts = knipStrook(vorm, m.start, u, a, b);
        if (pts.length >= 3) uit.push({ soort: "muur", punten: pts, z0: peil + z0, z1: peil + z1, kleur, naam: `muur ${m.id}` });
      }
    }
    for (const o of gaten) {
      const a = puntLangsMuur(m, o.offset), b = puntLangsMuur(m, o.offset + o.breedte);
      const n = { x: -u.y, y: u.x }, d = o.soort === "deur" ? 20 : 12;
      const blok = [
        { x: a.x - n.x * d, y: a.y - n.y * d }, { x: b.x - n.x * d, y: b.y - n.y * d },
        { x: b.x + n.x * d, y: b.y + n.y * d }, { x: a.x + n.x * d, y: a.y + n.y * d },
      ];
      if (o.soort === "raam") uit.push({ soort: "glas", punten: blok, z0: peil + o.borstwering, z1: peil + o.borstwering + o.hoogte, kleur: "#bfdbfe", doorzichtig: true, naam: `raam ${o.id}` });
      if (o.soort === "deur" && !isBuiten(v, m.id)) uit.push({ soort: "deur", punten: blok, z0: peil, z1: peil + o.hoogte, kleur: "#a8a29e", naam: `deur ${o.id}` });
      if (o.soort === "deur" && isBuiten(v, m.id)) uit.push({ soort: "deur", punten: blok, z0: peil, z1: peil + o.hoogte, kleur: "#57534e", naam: `voordeur ${o.id}` });
    }
  }
  return uit;
}

const isBuiten = (v: Verdieping, muurId: string) => v.ruimtes.filter((r) => r.muurIds.includes(muurId)).length < 2;

function meubelPrismas(v: Verdieping, peil: number): Prisma[] {
  const uit: Prisma[] = [];
  for (const m of v.meubels) {
    const d = DEF.get(m.soort);
    const kleur = m.kleur ?? d?.kleur ?? "#a8a29e";
    const h = meubelHoeken(m);
    const naam = d?.naam ?? m.soort;
    if (m.soort === "bed1" || m.soort === "bed2") {
      uit.push({ soort: "meubel", punten: h, z0: peil, z1: peil + 300, kleur: "#78716c", naam });
      uit.push({ soort: "meubel", punten: verklein(m, 0.97, 0.95, 0.02), z0: peil + 300, z1: peil + m.hoogte, kleur, naam: `${naam} matras` });
      uit.push({ soort: "meubel", punten: deel(m, 0, 1, 0.88, 1), z0: peil, z1: peil + 1000, kleur: "#78716c", naam: `${naam} hoofdbord` });
    } else if (m.soort === "zetel3" || m.soort === "fauteuil") {
      uit.push({ soort: "meubel", punten: h, z0: peil, z1: peil + 420, kleur, naam });
      uit.push({ soort: "meubel", punten: deel(m, 0, 1, 0.75, 1), z0: peil + 420, z1: peil + m.hoogte, kleur, naam: `${naam} rug` });
      uit.push({ soort: "meubel", punten: deel(m, 0, 0.1, 0, 0.75), z0: peil + 420, z1: peil + 620, kleur, naam: `${naam} arm` });
      uit.push({ soort: "meubel", punten: deel(m, 0.9, 1, 0, 0.75), z0: peil + 420, z1: peil + 620, kleur, naam: `${naam} arm` });
    } else if (m.soort === "eettafel" || m.soort === "salontafel" || m.soort === "bureau") {
      uit.push({ soort: "meubel", punten: h, z0: peil + m.hoogte - 40, z1: peil + m.hoogte, kleur, naam: `${naam} blad` });
      for (const [x, y] of [[0.04, 0.06], [0.96, 0.06], [0.96, 0.94], [0.04, 0.94]] as const) uit.push({ soort: "meubel", punten: deel(m, x - 0.025, x + 0.025, y - 0.04, y + 0.04), z0: peil, z1: peil + m.hoogte - 40, kleur: "#44403c", naam: `${naam} poot` });
    } else if (m.soort === "keuken" || m.soort === "eiland") {
      uit.push({ soort: "meubel", punten: verklein(m, 1, 0.95, -0.025), z0: peil + 100, z1: peil + m.hoogte - 40, kleur, naam });
      uit.push({ soort: "meubel", punten: h, z0: peil + m.hoogte - 40, z1: peil + m.hoogte, kleur: "#292524", naam: `${naam} werkblad` });
    } else {
      uit.push({ soort: "meubel", punten: h, z0: peil, z1: peil + m.hoogte, kleur, naam });
    }
  }
  return uit;
}

/** Deel van een meubel: fracties langs breedte (x) en diepte (y), 0 = voorkant/links. */
function deel(m: Meubel, x0: number, x1: number, y0: number, y1: number): Punt[] {
  const a = (m.hoek * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([fx, fy]) => {
    const x = (fx! - 0.5) * m.breedte, y = (fy! - 0.5) * m.diepte;
    return { x: m.positie.x + x * c - y * s, y: m.positie.y + x * s + y * c };
  });
}
const verklein = (m: Meubel, fb: number, fd: number, dy = 0) => deel(m, 0.5 - fb / 2, 0.5 + fb / 2, 0.5 - fd / 2 + dy, 0.5 + fd / 2 + dy);

export interface Model3D { prismas: Prisma[]; midden: Punt; grootte: number; hoogte: number }

/** 3D-model van het project (nieuwe toestand): muren met gaten, vloeren in hun materiaal, ramen, deuren en meubels. */
export function model3D(p: Project, o: { verdiepingId?: string; toestand?: "bestaand" | "nieuw" } = {}): Model3D {
  const verdiepingen = p.verdiepingen.filter((v) => !o.verdiepingId || v.id === o.verdiepingId);
  const prismas: Prisma[] = [];
  for (const v0 of verdiepingen) {
    const v = verdiepingInToestand(v0, o.toestand ?? "nieuw");
    for (const r of v.ruimtes) prismas.push({ soort: "vloer", punten: r.contour, z0: v.peil - 30, z1: v.peil, kleur: materiaal(r.afwerking?.vloer)?.kleur ?? "#d6d3d1", naam: `vloer ${r.naam}` });
    prismas.push(...muurPrismas(v, v.peil));
    prismas.push(...meubelPrismas(v, v.peil));
  }
  const alle = prismas.flatMap((x) => x.punten);
  const xs = alle.map((q) => q.x), ys = alle.map((q) => q.y);
  const midden = alle.length ? { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 } : { x: 0, y: 0 };
  const grootte = alle.length ? Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) : 1000;
  const hoogte = Math.max(2500, ...prismas.map((x) => x.z1));
  return { prismas, midden, grootte, hoogte };
}

export const ruimteVanMeubel = (v: Verdieping, m: Meubel): Ruimte | undefined => v.ruimtes.find((r) => binnen(m.positie, r.contour));
