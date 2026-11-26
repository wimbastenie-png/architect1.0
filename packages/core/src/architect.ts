/**
 * Architect: vergunningsklare basis.
 * - Dak (plat, zadeldak, lessenaarsdak) boven de bovenste verdieping, op een
 *   rechthoekige voetafdruk (omhullende van de buitenmuren) met overstek.
 * - Rechte trap met optrede en aantrede, comfortregel 2·o + a ≈ 630 mm.
 * - Terrein: perceel, maaiveld, inplantingsplan met afstanden tot de grenzen.
 * - Ruimtes van de nieuwe toestand opnieuw indelen (afbreken samenvoegen, nieuwe muren splitsen).
 *
 * Vergunningsklare BASIS: de architect controleert, vult aan en tekent.
 * De app geeft nooit een oordeel "conform".
 */
import { naaiSamen, haakseVereniging } from "./bewerken.ts";
import { muurLengte, muurVorm, oppervlakte } from "./geometrie.ts";
import type { Tekening, TekenEl } from "./ontwerp.ts";
import type { Muur, Project, Punt, Ruimte, Verdieping } from "./schema.ts";

export const ARCHITECT_DISCLAIMER =
  "Vergunningsklare basis ter voorbereiding: de architect controleert, vult aan en tekent het vergunningsdossier. Stedenbouwkundige voorschriften, EPB en brandveiligheid na te kijken. De app geeft nooit een oordeel 'conform'.";

// ---------------------------------------------------------------------------
// dak

export interface DakVoet { x0: number; x1: number; y0: number; y1: number; basis: number; verdieping: Verdieping }

/** Voetafdruk (buitenkant van de muren) van de bovenste verdieping en de hoogte van de muurplaat. */
export function dakVoet(p: Project): DakVoet | null {
  const top = [...p.verdiepingen].sort((a, b) => b.peil - a.peil)[0];
  if (!top || !top.muren.length) return null;
  const pts = top.muren.filter((m) => m.toestand !== "afbreken").flatMap((m) => muurVorm(m, top.muren));
  const xs = pts.map((q) => q.x), ys = pts.map((q) => q.y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), basis: top.peil + Math.max(...top.muren.map((m) => m.hoogte)), verdieping: top };
}

const rad = (g: number) => (g * Math.PI) / 180;

/** Hoogte van de onderkant van het dakvlak boven punt (x, y), of null buiten de voet + overstek. */
export function dakOnder(p: Project, x: number, y: number, v = dakVoet(p)): number | null {
  const d = p.dak;
  if (!d || !v) return null;
  const o = d.overstek;
  if (x < v.x0 - o - 1 || x > v.x1 + o + 1 || y < v.y0 - o - 1 || y > v.y1 + o + 1) return null;
  if (d.soort === "plat") return v.basis;
  const t = Math.tan(rad(d.helling));
  const [c, a0, a1] = d.nok === "x" ? [y, v.y0, v.y1] : [x, v.x0, v.x1];
  if (d.soort === "zadel") { const mid = (a0 + a1) / 2, half = (a1 - a0) / 2; return v.basis + (half - Math.abs(c - mid)) * t; }
  return v.basis + (c - a0) * t; // lessenaar: hoog aan de kant van y1 (nok x) of x1 (nok y)
}

/** Bovenkant van het dak (onderkant + dikte loodrecht op het dakvlak). */
export function dakBoven(p: Project, x: number, y: number, v = dakVoet(p)): number | null {
  const z = dakOnder(p, x, y, v);
  if (z === null || !p.dak) return null;
  return z + p.dak.dikte / Math.cos(rad(p.dak.soort === "plat" ? 0 : p.dak.helling));
}

export function nokHoogte(p: Project): number | null {
  const v = dakVoet(p);
  if (!v || !p.dak) return null;
  if (p.dak.soort === "plat") return v.basis + p.dak.dikte;
  const c = p.dak.nok === "x" ? (p.dak.soort === "zadel" ? [(v.x0 + v.x1) / 2, (v.y0 + v.y1) / 2] : [(v.x0 + v.x1) / 2, v.y1]) : (p.dak.soort === "zadel" ? [(v.x0 + v.x1) / 2, (v.y0 + v.y1) / 2] : [v.x1, (v.y0 + v.y1) / 2]);
  return dakBoven(p, c[0]!, c[1]!, v);
}

export interface Vlak3D { punten: Array<{ x: number; y: number; z: number }>; kleur: string; naam: string }

/** Dakvlakken en topgevels voor de 3D-weergave (plan-mm, z = hoogte). */
export function dakVlakken(p: Project): Vlak3D[] {
  const v = dakVoet(p), d = p.dak;
  if (!v || !d || d.soort === "plat") return [];
  const o = d.overstek, kleur = "#7f1d1d", muur = "#e7e5e4";
  const z = (x: number, y: number) => dakBoven(p, x, y, v)!;
  const P = (x: number, y: number, zz?: number) => ({ x, y, z: zz ?? z(x, y) });
  const X0 = v.x0 - o, X1 = v.x1 + o, Y0 = v.y0 - o, Y1 = v.y1 + o;
  const uit: Vlak3D[] = [];
  if (d.nok === "x") {
    const mid = (v.y0 + v.y1) / 2;
    if (d.soort === "zadel") {
      uit.push({ punten: [P(X0, Y0), P(X1, Y0), P(X1, mid), P(X0, mid)], kleur, naam: "dakvlak voor" });
      uit.push({ punten: [P(X0, mid), P(X1, mid), P(X1, Y1), P(X0, Y1)], kleur, naam: "dakvlak achter" });
      for (const x of [v.x0, v.x1]) uit.push({ punten: [P(x, v.y0, v.basis), P(x, mid, dakOnder(p, x, mid, v)!), P(x, v.y1, v.basis)], kleur: muur, naam: "topgevel" });
    } else {
      uit.push({ punten: [P(X0, Y0), P(X1, Y0), P(X1, Y1), P(X0, Y1)], kleur, naam: "dakvlak" });
      for (const x of [v.x0, v.x1]) uit.push({ punten: [P(x, v.y0, v.basis), P(x, v.y1, dakOnder(p, x, v.y1, v)!), P(x, v.y1, v.basis)], kleur: muur, naam: "zijgevel" });
      uit.push({ punten: [P(v.x0, v.y1, v.basis), P(v.x1, v.y1, v.basis), P(v.x1, v.y1, dakOnder(p, v.x1, v.y1, v)!), P(v.x0, v.y1, dakOnder(p, v.x0, v.y1, v)!)], kleur: muur, naam: "hoge gevel" });
    }
  } else {
    const mid = (v.x0 + v.x1) / 2;
    if (d.soort === "zadel") {
      uit.push({ punten: [P(X0, Y0), P(mid, Y0), P(mid, Y1), P(X0, Y1)], kleur, naam: "dakvlak links" });
      uit.push({ punten: [P(mid, Y0), P(X1, Y0), P(X1, Y1), P(mid, Y1)], kleur, naam: "dakvlak rechts" });
      for (const y of [v.y0, v.y1]) uit.push({ punten: [P(v.x0, y, v.basis), P(mid, y, dakOnder(p, mid, y, v)!), P(v.x1, y, v.basis)], kleur: muur, naam: "topgevel" });
    } else {
      uit.push({ punten: [P(X0, Y0), P(X1, Y0), P(X1, Y1), P(X0, Y1)], kleur, naam: "dakvlak" });
      for (const y of [v.y0, v.y1]) uit.push({ punten: [P(v.x0, y, v.basis), P(v.x1, y, dakOnder(p, v.x1, y, v)!), P(v.x1, y, v.basis)], kleur: muur, naam: "zijgevel" });
      uit.push({ punten: [P(v.x1, v.y0, v.basis), P(v.x1, v.y1, v.basis), P(v.x1, v.y1, dakOnder(p, v.x1, v.y1, v)!), P(v.x1, v.y0, dakOnder(p, v.x1, v.y0, v)!)], kleur: muur, naam: "hoge gevel" });
    }
  }
  return uit;
}

/** Dak in een doorsnede langs AB: band tussen onder- en bovenkant (x = afstand vanaf A). */
export function dakInDoorsnede(p: Project, a: Punt, b: Punt): TekenEl[] {
  const v = dakVoet(p);
  if (!v || !p.dak) return [];
  const L = Math.hypot(b.x - a.x, b.y - a.y), n = 240;
  const onder: Punt[] = [], boven: Punt[] = [];
  // fracties: regelmatig + exact op de nok en de randen (overstek)
  const fr = new Set<number>();
  for (let k = 0; k <= n; k++) fr.add(k / n);
  const o = p.dak.overstek;
  const lijnen: Array<["x" | "y", number]> = [["x", v.x0 - o], ["x", v.x1 + o], ["y", v.y0 - o], ["y", v.y1 + o], ["x", v.x0], ["x", v.x1], ["y", v.y0], ["y", v.y1], ["x", (v.x0 + v.x1) / 2], ["y", (v.y0 + v.y1) / 2]];
  for (const [as, w] of lijnen) {
    const d = as === "x" ? b.x - a.x : b.y - a.y;
    if (Math.abs(d) < 1e-9) continue;
    const f = (w - (as === "x" ? a.x : a.y)) / d;
    if (f > 0 && f < 1) { fr.add(f); fr.add(Math.min(1, f + 1e-6)); fr.add(Math.max(0, f - 1e-6)); }
  }
  for (const f of [...fr].sort((x, y) => x - y)) {
    const k = f * n;
    const t = (L * k) / n, x = a.x + ((b.x - a.x) * k) / n, y = a.y + ((b.y - a.y) * k) / n;
    const zo = dakOnder(p, x, y, v), zb = dakBoven(p, x, y, v);
    if (zo === null || zb === null) continue;
    onder.push({ x: t, y: zo }); boven.push({ x: t, y: zb });
  }
  if (onder.length < 2) return [];
  return [{ t: "veelhoek", punten: [...onder, ...boven.reverse()], vul: "#a8a29e", lijn: "#1c1917", dikte: 10 }];
}

/** Dak in een gevelaanzicht: topgevel (muurkleur) en dakband, met as u naar rechts en kijkrichting k. */
export function dakInAanzicht(p: Project, u: Punt, k: Punt): TekenEl[] {
  const v = dakVoet(p), d = p.dak;
  if (!v || !d) return [];
  const o = d.overstek, N = 80;
  const bins = new Map<number, { top: number; voorDiepte: number; voorOnder: number; muurDiepte: number; muurOnder: number }>();
  const stap = Math.max(v.x1 - v.x0, v.y1 - v.y0) / N;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const x = v.x0 - o + ((v.x1 - v.x0 + 2 * o) * i) / N, y = v.y0 - o + ((v.y1 - v.y0 + 2 * o) * j) / N;
    const zb = dakBoven(p, x, y, v), zo = dakOnder(p, x, y, v);
    if (zb === null || zo === null) continue;
    const uu = Math.round((x * u.x + y * u.y) / stap), diepte = x * k.x + y * k.y;
    const binnenMuren = x >= v.x0 - 1 && x <= v.x1 + 1 && y >= v.y0 - 1 && y <= v.y1 + 1;
    const b = bins.get(uu) ?? { top: -Infinity, voorDiepte: Infinity, voorOnder: 0, muurDiepte: Infinity, muurOnder: v.basis };
    b.top = Math.max(b.top, zb);
    if (diepte < b.voorDiepte) { b.voorDiepte = diepte; b.voorOnder = zo; }
    if (binnenMuren && diepte < b.muurDiepte) { b.muurDiepte = diepte; b.muurOnder = Math.max(v.basis, zo); }
    bins.set(uu, b);
  }
  const rij = [...bins.entries()].sort((a, b) => a[0] - b[0]);
  if (rij.length < 2) return [];
  const el: TekenEl[] = [];
  const gevel = rij.filter(([, b]) => b.muurDiepte < Infinity);
  if (gevel.some(([, b]) => b.muurOnder > v.basis + 50)) el.push({ t: "veelhoek", punten: [...gevel.map(([uu, b]) => ({ x: uu * stap, y: b.muurOnder })), ...gevel.slice().reverse().map(([uu]) => ({ x: uu * stap, y: v.basis }))], vul: "#f5f5f4", lijn: "#1c1917", dikte: 12 });
  el.push({ t: "veelhoek", punten: [...rij.map(([uu, b]) => ({ x: uu * stap, y: b.top })), ...rij.slice().reverse().map(([uu, b]) => ({ x: uu * stap, y: Math.min(b.voorOnder, b.top - 10) }))], vul: d.soort === "plat" ? "#78716c" : "#991b1b", lijn: "#1c1917", dikte: 12 });
  return el;
}

// ---------------------------------------------------------------------------
// trap

export type Trap = Verdieping["trappen"][number];

/** Voorstel voor een trap tussen deze verdieping en de volgende (comfortregel 2·o + a = 630). */
export function trapVoorstel(hoogte: number, start: Punt, richting = 0, breedte = 900): Trap {
  const treden = Math.max(2, Math.round(hoogte / 180));
  const optrede = Math.round(hoogte / treden);
  return { id: `trap-${Date.now().toString(36)}`, start: { x: Math.round(start.x), y: Math.round(start.y) }, richting, breedte, treden, optrede, aantrede: Math.max(220, 630 - 2 * optrede) };
}

export function trapGeometrie(t: Trap) {
  const u = { x: Math.cos(rad(t.richting)), y: Math.sin(rad(t.richting)) }, n = { x: -u.y, y: u.x };
  const loop = (t.treden - 1) * t.aantrede;
  const P = (l: number, s: number) => ({ x: t.start.x + u.x * l + n.x * s, y: t.start.y + u.y * l + n.y * s });
  const omtrek = [P(-t.aantrede / 2, -t.breedte / 2), P(loop + t.aantrede / 2, -t.breedte / 2), P(loop + t.aantrede / 2, t.breedte / 2), P(-t.aantrede / 2, t.breedte / 2)];
  const treden = Array.from({ length: t.treden }, (_, i) => [P(i * t.aantrede - t.aantrede / 2, -t.breedte / 2), P(i * t.aantrede - t.aantrede / 2, t.breedte / 2)] as [Punt, Punt]);
  return { u, n, loop, omtrek, treden, P };
}

export interface TrapOpmerking { ernst: "let op" | "info"; tekst: string }

export function controleerTrap(p: Project, v: Verdieping, t: Trap): TrapOpmerking[] {
  const uit: TrapOpmerking[] = [];
  const boven = p.verdiepingen.filter((x) => x.peil > v.peil).sort((a, b) => a.peil - b.peil)[0];
  const H = boven ? boven.peil - v.peil : null;
  const regel = 2 * t.optrede + t.aantrede;
  uit.push({ ernst: regel < 600 || regel > 650 ? "let op" : "info", tekst: `Comfortregel: 2 × ${t.optrede} + ${t.aantrede} = ${regel} mm (gangbaar 600 à 650, ideaal ± 630).` });
  if (t.optrede > 200) uit.push({ ernst: "let op", tekst: `Optrede ${t.optrede} mm is steil (gangbaar ≤ 180 à 190 mm in een woning).` });
  if (t.aantrede < 230) uit.push({ ernst: "let op", tekst: `Aantrede ${t.aantrede} mm is klein (gangbaar ≥ 230 mm).` });
  if (t.breedte < 800) uit.push({ ernst: "let op", tekst: `Trapbreedte ${t.breedte} mm is smal (gangbaar ≥ 800 à 900 mm; brandvoorschriften na te kijken).` });
  if (H !== null && Math.abs(t.treden * t.optrede - H) > 10) uit.push({ ernst: "let op", tekst: `${t.treden} × ${t.optrede} = ${t.treden * t.optrede} mm, maar de verdiepingshoogte is ${H} mm.` });
  if (boven) {
    const g = trapGeometrie(t);
    const xs = g.omtrek.map((q) => q.x), ys = g.omtrek.map((q) => q.y);
    const midden = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
    const gat = boven.sparingen.some((s) => s.soort === "trapgat" && binnen(midden, s.contour));
    if (!gat) uit.push({ ernst: "let op", tekst: `Geen trapgat boven de trap op ${boven.naam} (sparing in de vloer). Vrije hoogte boven de trap na te kijken (gangbaar ≥ 2,10 à 2,30 m).` });
  }
  return uit;
}

const binnen = (p: Punt, c: Punt[]) => {
  let in_ = false;
  for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
    const a = c[i]!, b = c[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) in_ = !in_;
  }
  return in_;
};

/** Trap in een doorsnede langs AB: treden als zaagtand waar de snijlijn de trap volgt, anders een kader. */
export function trapInDoorsnede(t: Trap, v: Verdieping, H: number, a: Punt, b: Punt): TekenEl[] {
  const g = trapGeometrie(t);
  const L = Math.hypot(b.x - a.x, b.y - a.y), d = { x: (b.x - a.x) / L, y: (b.y - a.y) / L };
  const par = d.x * g.u.x + d.y * g.u.y;
  // afstand van de lijn tot de trapas
  const afst = Math.abs((t.start.x - a.x) * -d.y + (t.start.y - a.y) * d.x);
  if (Math.abs(par) < 0.7 || afst > t.breedte) return [];
  const pts: Punt[] = [];
  for (let i = 0; i < t.treden; i++) {
    const l = i * t.aantrede - t.aantrede / 2, q = g.P(l, 0);
    const s = (q.x - a.x) * d.x + (q.y - a.y) * d.y, s2 = s + t.aantrede * Math.sign(par);
    const z0 = v.peil + i * t.optrede, z1 = v.peil + (i + 1) * t.optrede;
    pts.push({ x: s, y: z0 }, { x: s, y: Math.min(z1, v.peil + H) }, { x: s2, y: Math.min(z1, v.peil + H) });
  }
  return [{ t: "veelhoek", punten: [...pts, { x: pts[pts.length - 1]!.x, y: v.peil }, { x: pts[0]!.x, y: v.peil }], vul: "#d6d3d1", lijn: "#1c1917", dikte: 8 }];
}

// ---------------------------------------------------------------------------
// terrein en inplantingsplan

/** Perceel als rechthoek rond het gebouw: breedte × diepte, met afstand voorgevel–straat en linkergevel–grens. */
export function perceelRechthoek(p: Project, breedte: number, diepte: number, voortuin: number, links: number): Punt[] {
  const v = [...p.verdiepingen].sort((a, b) => a.peil - b.peil)[0]!;
  const pts = v.muren.flatMap((m) => muurVorm(m, v.muren));
  const x0 = Math.min(...pts.map((q) => q.x)) - links, y0 = Math.min(...pts.map((q) => q.y)) - voortuin;
  return [{ x: x0, y: y0 }, { x: x0 + breedte, y: y0 }, { x: x0 + breedte, y: y0 + diepte }, { x: x0, y: y0 + diepte }].map((q) => ({ x: Math.round(q.x), y: Math.round(q.y) }));
}

/** Kleinste afstand van het gebouw (gelijkvloers, buitenkant muren) tot elke perceelgrens (mm). */
export function afstandenTotGrenzen(p: Project): number[] {
  if (!p.terrein) return [];
  const v = [...p.verdiepingen].sort((a, b) => a.peil - b.peil)[0]!;
  const pts = v.muren.filter((m) => m.toestand !== "afbreken").flatMap((m) => muurVorm(m, v.muren));
  const c = p.terrein.perceel;
  return c.map((a, k) => {
    const b = c[(k + 1) % c.length]!, L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return Math.round(Math.min(...pts.map((q) => Math.abs((q.x - a.x) * (b.y - a.y) - (q.y - a.y) * (b.x - a.x)) / L)));
  });
}

export function inplantingsplan(p: Project): Tekening {
  const el: TekenEl[] = [];
  const v = [...p.verdiepingen].sort((a, b) => a.peil - b.peil)[0]!;
  if (p.terrein) el.push({ t: "veelhoek", punten: p.terrein.perceel, vul: "#ecfccb", lijn: "#3f6212", dikte: 30 });
  for (const m of v.muren.filter((x) => x.toestand !== "afbreken")) el.push({ t: "veelhoek", punten: muurVorm(m, v.muren), vul: m.toestand === "nieuw" ? "#dc2626" : "#292524", lijn: "#1c1917", dikte: 4 });
  for (const r of v.ruimtes) el.push({ t: "veelhoek", punten: r.contour, vul: "#f5f5f4", dikte: 0 });
  if (p.terrein) {
    const afst = afstandenTotGrenzen(p);
    p.terrein.perceel.forEach((a, k) => {
      const b = p.terrein!.perceel[(k + 1) % p.terrein!.perceel.length]!;
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      el.push({ t: "tekst", p: { x: m.x, y: m.y + 150 }, s: `${(Math.hypot(b.x - a.x, b.y - a.y) / 1000).toFixed(2).replace(".", ",")} m · tot gebouw ${(afst[k]! / 1000).toFixed(2).replace(".", ",")} m`, grootte: 260, anker: "middle", kleur: "#3f6212" });
    });
    if (p.terrein.straat) el.push({ t: "tekst", p: { x: (p.terrein.perceel[0]!.x + p.terrein.perceel[1]!.x) / 2, y: p.terrein.perceel[0]!.y - 900 }, s: p.terrein.straat, grootte: 360, anker: "middle", kleur: "#1c1917", vet: true });
  }
  const alle = el.flatMap((e) => (e.t === "veelhoek" ? e.punten : e.t === "tekst" ? [e.p] : []));
  const xs = alle.map((q) => q.x), ys = alle.map((q) => q.y);
  return { titel: "Inplantingsplan", elementen: el, minX: Math.min(...xs) - 1500, maxX: Math.max(...xs) + 1500, minY: Math.min(...ys) - 1500, maxY: Math.max(...ys) + 1500 };
}

// ---------------------------------------------------------------------------
// ruimtes van de nieuwe toestand

function knip(poly: Punt[], n: Punt, c: number): Punt[] {
  const f = (q: Punt) => q.x * n.x + q.y * n.y - c;
  const uit: Punt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
    const fa = f(a), fb = f(b);
    if (fa >= 0) uit.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); uit.push({ x: Math.round(a.x + (b.x - a.x) * t), y: Math.round(a.y + (b.y - a.y) * t) }); }
  }
  return uit;
}

/**
 * Nieuwe indeling: ruimtes aan weerszijden van een af te breken muur worden
 * één ruimte; een nieuwe muur die een ruimte van wand tot wand doorkruist,
 * splitst ze in twee (elk tot het muurvlak). Geeft de verdieping met `ruimtesNieuw`
 * en meldingen terug.
 */
export function deelRuimtesIn(v: Verdieping): { verdieping: Verdieping; meldingen: string[] } {
  const meldingen: string[] = [];
  let ruimtes: Ruimte[] = v.ruimtes.map((r) => ({ ...r }));
  for (const m of v.muren.filter((x) => x.toestand === "afbreken")) {
    const twee = ruimtes.filter((r) => r.muurIds.includes(m.id));
    if (twee.length !== 2) continue;
    const [a, b] = twee as [Ruimte, Ruimte];
    let contour: Punt[];
    try { contour = naaiSamen(a, b, m); } catch { try { contour = haakseVereniging([a.contour, b.contour]); } catch { meldingen.push(`${a.naam} en ${b.naam} konden niet samengevoegd worden (vorm te complex).`); continue; } }
    const groot = oppervlakte(a.contour) >= oppervlakte(b.contour) ? a : b;
    ruimtes = ruimtes.filter((r) => r !== a && r !== b);
    ruimtes.push({ ...groot, id: `${groot.id}-n`, naam: `${a.naam} + ${b.naam}`, contour, plafondhoogte: Math.min(a.plafondhoogte, b.plafondhoogte), muurIds: [...new Set([...a.muurIds, ...b.muurIds])].filter((x) => x !== m.id) });
    meldingen.push(`${a.naam} en ${b.naam} worden één ruimte (muur afgebroken).`);
  }
  for (const m of v.muren.filter((x) => x.toestand === "nieuw")) {
    const L = muurLengte(m);
    const u = { x: (m.eind.x - m.start.x) / L, y: (m.eind.y - m.start.y) / L }, n = { x: -u.y, y: u.x };
    const mid = { x: (m.start.x + m.eind.x) / 2, y: (m.start.y + m.eind.y) / 2 };
    const r = ruimtes.find((x) => binnen(mid, x.contour));
    if (!r) continue;
    const c = mid.x * n.x + mid.y * n.y;
    const a = knip(r.contour, n, c + m.dikte / 2), b = knip(r.contour, { x: -n.x, y: -n.y }, -(c - m.dikte / 2));
    const breed = oppervlakte(r.contour) * 0.05;
    if (a.length < 3 || b.length < 3 || oppervlakte(a) < breed || oppervlakte(b) < breed) continue;
    // splitst de muur echt van wand tot wand? (lengte ≈ breedte van de ruimte langs de muur)
    const t = r.contour.map((q) => (q.x - mid.x) * u.x + (q.y - mid.y) * u.y);
    if (L < (Math.max(...t) - Math.min(...t)) * 0.85) { meldingen.push(`De nieuwe muur in ${r.naam} loopt niet van wand tot wand: ruimte niet gesplitst.`); continue; }
    const muren = (poly: Punt[]) => r.muurIds.filter((id) => { const w = v.muren.find((x) => x.id === id); return w && poly.some((q) => afstTotMuur(q, w) <= w.dikte / 2 + 5); });
    ruimtes = ruimtes.filter((x) => x !== r);
    ruimtes.push({ ...r, id: `${r.id}-a`, naam: `${r.naam} (1)`, contour: a, muurIds: [...muren(a), m.id] });
    ruimtes.push({ ...r, id: `${r.id}-b`, naam: `${r.naam} (2)`, contour: b, muurIds: [...muren(b), m.id] });
    meldingen.push(`${r.naam} wordt in twee gesplitst door de nieuwe muur.`);
  }
  return { verdieping: { ...v, ruimtesNieuw: ruimtes }, meldingen };
}

function afstTotMuur(q: Punt, m: Muur): number {
  const L = muurLengte(m) || 1, u = { x: (m.eind.x - m.start.x) / L, y: (m.eind.y - m.start.y) / L };
  const t = Math.max(0, Math.min(L, (q.x - m.start.x) * u.x + (q.y - m.start.y) * u.y));
  return Math.hypot(q.x - (m.start.x + u.x * t), q.y - (m.start.y + u.y * t));
}

/** Project in de nieuwe toestand (voor de meetstaat en het lastenboek van de nieuwe toestand). */
export function projectNieuweToestand(p: Project, verdiepingInToestand: (v: Verdieping, w: "nieuw") => Verdieping): Project {
  return { ...p, verdiepingen: p.verdiepingen.map((v) => verdiepingInToestand(v, "nieuw")) };
}
