/**
 * Keuken en maatwerk: precisiemeting per wand, wandaanzicht met openingen en
 * aansluitingen, keukenplanner (modules, werkblad, passtukken), controle
 * tegen de installatiepunten, kasten- en snijlijst, DXF.
 *
 * Voorbereiding voor de keukenbouwer of meubelmaker: maten NA TE METEN ter
 * plaatse vóór productie. De app geeft nooit een oordeel "conform".
 */
import { Dxf } from "./dxf.ts";
import { soortDef } from "./installaties.ts";
import type { Tekening, TekenEl } from "./ontwerp.ts";
import type { Project, Punt, Ruimte, Verdieping } from "./schema.ts";

export type Maatwerk = Project["maatwerk"][number];
export type Kast = Maatwerk["kasten"][number];
export type KastSoort = Kast["soort"];
export type KastFunctie = Kast["functie"];

export const MODULES = [300, 400, 450, 500, 600, 800, 900];
export const MAAT = {
  plint: 100,
  onderHoogte: 720, // kast zonder plint en werkblad
  werkbladDikte: 38,
  werkbladDiepte: 620,
  onderDiepte: 560,
  bovenOnderkant: 1450,
  bovenHoogte: 720,
  bovenDiepte: 350,
  hoogHoogte: 2100, // incl. plint
  plaat: 18,
  maxWerkblad: 3000,
};

export const KEUKEN_DISCLAIMER =
  "Voorbereiding voor de keukenbouwer of meubelmaker. Alle maten na te meten ter plaatse vóór productie. De app geeft nooit een oordeel 'conform'.";

export interface Wand {
  ruimte: Ruimte;
  verdieping: Verdieping;
  rand: number;
  a: Punt; // links (gezien vanuit de ruimte)
  b: Punt; // rechts
  lengte: number; // mm, uit het model
  hoogte: number; // plafondhoogte
}

/** Randen van een ruimte als wanden, links → rechts gezien vanuit de ruimte. */
export function wandenVan(v: Verdieping, r: Ruimte): Wand[] {
  const c = r.contour;
  return c.map((p, k) => {
    const q = c[(k + 1) % c.length]!;
    // contour tegen de klok in: binnenkant links van p→q; wie naar de wand kijkt, heeft q links en p rechts
    return { ruimte: r, verdieping: v, rand: k, a: q, b: p, lengte: Math.round(Math.hypot(q.x - p.x, q.y - p.y)), hoogte: r.plafondhoogte };
  });
}

export function zoekWand(p: Project, w: Maatwerk): Wand | null {
  for (const v of p.verdiepingen) {
    const r = v.ruimtes.find((x) => x.id === w.ruimteId);
    if (r) return wandenVan(v, r)[w.rand] ?? null;
  }
  return null;
}

/** Beschikbare breedte: de kleinste gemeten lengte (vloer, midden, plafond), anders het model. */
export function beschikbaar(w: Maatwerk, wand: Wand): { breedte: number; bron: "gemeten" | "model" } {
  const m = [w.meting.onder, w.meting.midden, w.meting.boven].filter((x): x is number => typeof x === "number");
  return m.length ? { breedte: Math.min(...m), bron: "gemeten" } : { breedte: wand.lengte, bron: "model" };
}

const projecteer = (wand: Wand, q: Punt) => {
  const L = wand.lengte || 1, u = { x: (wand.b.x - wand.a.x) / L, y: (wand.b.y - wand.a.y) / L };
  const t = (q.x - wand.a.x) * u.x + (q.y - wand.a.y) * u.y;
  const afst = Math.abs((q.x - wand.a.x) * -u.y + (q.y - wand.a.y) * u.x);
  return { t, afst };
};

export interface WandObject { soort: "raam" | "deur" | "doorgang" | "radiator" | "koud" | "warm" | "afvoer" | "gas" | "stopcontact" | "dampkap-afvoer" | "elektrisch-toestel"; x: number; breedte: number; onderkant: number; hoogte: number; naam: string }

/** Openingen, installatiepunten (binnen 400 mm van de wand) en extra aansluitingen op deze wand. */
export function wandObjecten(p: Project, w: Maatwerk, wand: Wand): WandObject[] {
  const v = wand.verdieping, uit: WandObject[] = [];
  for (const o of v.openingen) {
    const m = v.muren.find((x) => x.id === o.muurId);
    if (!m || o.toestand === "dicht") continue;
    const L = Math.hypot(m.eind.x - m.start.x, m.eind.y - m.start.y), u = { x: (m.eind.x - m.start.x) / L, y: (m.eind.y - m.start.y) / L };
    const p1 = { x: m.start.x + u.x * o.offset, y: m.start.y + u.y * o.offset }, p2 = { x: m.start.x + u.x * (o.offset + o.breedte), y: m.start.y + u.y * (o.offset + o.breedte) };
    const a = projecteer(wand, p1), b = projecteer(wand, p2);
    if (a.afst > m.dikte || b.afst > m.dikte) continue; // niet in deze wand
    const x0 = Math.max(0, Math.min(a.t, b.t)), x1 = Math.min(wand.lengte, Math.max(a.t, b.t));
    if (x1 - x0 < 50) continue;
    uit.push({ soort: o.soort, x: Math.round(x0), breedte: Math.round(x1 - x0), onderkant: o.borstwering, hoogte: o.hoogte, naam: `${o.soort} ${o.breedte} × ${o.hoogte}` });
  }
  const omzet: Record<string, WandObject["soort"] | undefined> = {
    stopcontact: "stopcontact", "stopcontact-dubbel": "stopcontact", kookplaat: "elektrisch-toestel", oven: "elektrisch-toestel", vaatwas: "elektrisch-toestel", wasmachine: "elektrisch-toestel",
    spoeltafel: "afvoer", "vaatwas-water": "afvoer", gaskookplaat: "gas",
  };
  for (const x of v.installaties) {
    const s = omzet[x.soort];
    if (!s) continue;
    const q = projecteer(wand, x.positie);
    if (q.afst > 400 || q.t < 0 || q.t > wand.lengte) continue;
    uit.push({ soort: s, x: Math.round(q.t), breedte: 80, onderkant: x.hoogte, hoogte: 80, naam: soortDef(x.soort)?.naam ?? x.soort });
    if (x.soort === "spoeltafel") { uit.push({ soort: "koud", x: Math.round(q.t) - 100, breedte: 40, onderkant: x.hoogte, hoogte: 40, naam: "koud water" }); uit.push({ soort: "warm", x: Math.round(q.t) + 100, breedte: 40, onderkant: x.hoogte, hoogte: 40, naam: "warm water" }); }
  }
  for (const a of w.aansluitingen) uit.push({ soort: a.soort, x: a.x, breedte: a.breedte ?? (a.soort === "radiator" ? 800 : 60), onderkant: a.hoogte, hoogte: a.hoogteObject ?? (a.soort === "radiator" ? 600 : 60), naam: a.soort });
  return uit.sort((a, b) => a.x - b.x);
}

export const kastHoogte = (k: Kast) => k.hoogte ?? (k.soort === "onder" ? MAAT.onderHoogte : k.soort === "boven" ? MAAT.bovenHoogte : MAAT.hoogHoogte - MAAT.plint);
export const kastDiepte = (k: Kast) => k.diepte ?? (k.soort === "boven" ? MAAT.bovenDiepte : MAAT.onderDiepte);
/** Onderkant van de kast boven de vloer. */
export const kastOnderkant = (k: Kast) => (k.soort === "boven" ? MAAT.bovenOnderkant : MAAT.plint);

/** Rij kasten van één soort (onder+hoog op de vloer, boven aan de muur). */
const rij = (w: Maatwerk, soort: "vloer" | "muur") => w.kasten.filter((k) => (soort === "muur" ? k.soort === "boven" : k.soort !== "boven")).sort((a, b) => a.x - b.x);

/**
 * Wand vullen: van links naar rechts met de grootste modules die passen; de
 * functies (spoelbak, kookplaat, vaatwas, oven, koelkast) worden op een
 * logische plaats gezet; wat overblijft, wordt een vulstuk (passtuk).
 */
export function vulWand(w: Maatwerk, wand: Wand, o: { hogeKastLinks?: boolean; bovenkasten?: boolean } = {}): Maatwerk {
  const B = beschikbaar(w, wand).breedte;
  const kasten: Kast[] = [];
  let x = 0, n = 0;
  const id = () => `k-${++n}`;
  if (o.hogeKastLinks !== false && B >= 2400) { kasten.push({ id: id(), soort: "hoog", functie: "koelkast", x, breedte: 600 }); x += 600; }
  // standaardvolgorde: lades, vaatwas, spoelbak, kast, kookplaat, lades …
  const wens: Array<[number, KastFunctie]> = [[600, "vaatwas"], [800, "spoelbak"], [600, "kast"], [600, "kookplaat"], [600, "lades"], [400, "kast"], [600, "kast"], [600, "kast"]];
  for (const [b0, f] of wens) {
    if (B - x < 300) break;
    const b = b0 <= B - x ? b0 : [...MODULES].reverse().find((m) => m <= B - x)!;
    if (f === "vaatwas" && b !== 600) continue;
    kasten.push({ id: id(), soort: "onder", functie: b === b0 ? f : "kast", x, breedte: b });
    x += b;
  }
  while (B - x >= 300) { const b = [...MODULES].reverse().find((m) => m <= B - x)!; kasten.push({ id: id(), soort: "onder", functie: "kast", x, breedte: b }); x += b; }
  if (B - x > 0) kasten.push({ id: id(), soort: "onder", functie: "vulstuk", x, breedte: B - x });
  if (o.bovenkasten !== false) {
    for (const k of kasten.filter((y) => y.soort === "onder" && y.functie !== "vulstuk")) {
      kasten.push({ id: id(), soort: "boven", functie: k.functie === "kookplaat" ? "dampkap" : "kast", x: k.x, breedte: k.breedte });
    }
    const vul = kasten.find((y) => y.functie === "vulstuk" && y.soort === "onder");
    if (vul) kasten.push({ id: id(), soort: "boven", functie: "vulstuk", x: vul.x, breedte: vul.breedte });
  }
  return { ...w, kasten };
}

export interface WerkbladStuk { van: number; tot: number; lengte: number; naden: number[]; uitsparingen: Array<{ x: number; breedte: number; diepte: number; voor: string }> }

/** Werkblad over de aaneengesloten onderkasten, met naden (max. plaatlengte) en uitsparingen. */
export function werkblad(w: Maatwerk): WerkbladStuk[] {
  const onder = w.kasten.filter((k) => k.soort === "onder").sort((a, b) => a.x - b.x);
  const stukken: WerkbladStuk[] = [];
  let huidig: Kast[] = [];
  const sluit = () => {
    if (!huidig.length) return;
    const van = huidig[0]!.x, tot = huidig[huidig.length - 1]!.x + huidig[huidig.length - 1]!.breedte;
    const naden: number[] = [];
    let begin = van;
    for (const k of huidig) {
      const eind = k.x + k.breedte;
      if (eind - begin > MAAT.maxWerkblad && k.x > begin) { naden.push(k.x); begin = k.x; }
    }
    const uitsparingen = huidig.filter((k) => k.functie === "spoelbak" || k.functie === "kookplaat").map((k) => {
      const b = k.functie === "spoelbak" ? Math.max(300, k.breedte - 100) : k.breedte >= 800 ? 750 : 560;
      return { x: k.x + (k.breedte - b) / 2, breedte: b, diepte: k.functie === "spoelbak" ? 440 : 490, voor: k.functie };
    });
    stukken.push({ van, tot, lengte: tot - van, naden, uitsparingen });
    huidig = [];
  };
  for (const k of onder) {
    const laatste = huidig[huidig.length - 1];
    if (laatste && Math.abs(laatste.x + laatste.breedte - k.x) > 1) sluit();
    huidig.push(k);
  }
  sluit();
  return stukken;
}

export interface KeukenOpmerking { ernst: "let op" | "info"; tekst: string; kastId?: string }

/** Controle: past alles, overlap, botsing met ramen, aansluitingen achter of onder de juiste kast, meting. */
export function controleerKeuken(p: Project, w: Maatwerk): KeukenOpmerking[] {
  const wand = zoekWand(p, w);
  if (!wand) return [{ ernst: "let op", tekst: "Deze wand bestaat niet meer (ruimte gewijzigd)." }];
  const uit: KeukenOpmerking[] = [];
  const { breedte: B, bron } = beschikbaar(w, wand);
  if (bron === "model") uit.push({ ernst: "let op", tekst: "Nog niet nagemeten: meet de wand op 3 hoogtes (laser) vóór je bestelt." });
  const metingen = [w.meting.onder, w.meting.midden, w.meting.boven].filter((x): x is number => typeof x === "number");
  if (metingen.length && Math.abs(Math.min(...metingen) - wand.lengte) > 200) uit.push({ ernst: "let op", tekst: `De gemeten lengte (${Math.min(...metingen)} mm) wijkt ${Math.abs(Math.min(...metingen) - wand.lengte)} mm af van het plan (${wand.lengte} mm): verkeerde wand gekozen, of het plan moet aangepast worden.` });
  if (metingen.length >= 2) {
    const verschil = Math.max(...metingen) - Math.min(...metingen);
    if (verschil > 5) uit.push({ ernst: "let op", tekst: `De wand verschilt ${verschil} mm tussen de metingen: muren niet evenwijdig of niet haaks. Plan met de kleinste maat (${Math.min(...metingen)} mm) en vul aan met passtukken.` });
  }
  for (const [kant, hoek] of [["linker", w.meting.hoekLinks], ["rechter", w.meting.hoekRechts]] as const) {
    if (hoek && Math.abs(hoek) > 0.2) uit.push({ ernst: "info", tekst: `${kant[0]!.toUpperCase()}${kant.slice(1)}hoek ${hoek > 0 ? "+" : ""}${String(hoek).replace(".", ",")}° uit haaks: over een werkbladdiepte van ${MAAT.werkbladDiepte} mm is dat ${Math.round(Math.tan((Math.abs(hoek) * Math.PI) / 180) * MAAT.werkbladDiepte)} mm. Werkblad en passtuk op maat afschrijven.` });
  }
  if (w.meting.vloerVerschil && Math.abs(w.meting.vloerVerschil) > 3) uit.push({ ernst: "info", tekst: `Vloer loopt ${Math.abs(w.meting.vloerVerschil)} mm af over de wand: stelpoten bijregelen, plint op maat.` });
  if (w.meting.lood && Math.abs(w.meting.lood) > 5) uit.push({ ernst: "info", tekst: `Muur ${Math.abs(w.meting.lood)} mm uit het lood: bovenkasten en hoge kasten uitvullen.` });
  for (const soort of ["vloer", "muur"] as const) {
    const ks = rij(w, soort);
    for (let i = 1; i < ks.length; i++) if (ks[i]!.x < ks[i - 1]!.x + ks[i - 1]!.breedte - 1) uit.push({ ernst: "let op", kastId: ks[i]!.id, tekst: `Kasten overlappen bij ${ks[i]!.x} mm.` });
    const eind = ks.length ? Math.max(...ks.map((k) => k.x + k.breedte)) : 0;
    if (eind > B + 1) uit.push({ ernst: "let op", tekst: `De ${soort === "vloer" ? "onderkasten" : "bovenkasten"} zijn ${eind - B} mm te lang voor de wand (${B} mm ${bron === "gemeten" ? "gemeten" : "volgens het model"}).` });
  }
  const objecten = wandObjecten(p, w, wand);
  for (const k of w.kasten) {
    const y0 = kastOnderkant(k), y1 = y0 + kastHoogte(k);
    for (const o of objecten) {
      const overlapX = o.x < k.x + k.breedte && o.x + o.breedte > k.x;
      const overlapY = o.onderkant < y1 && o.onderkant + o.hoogte > y0;
      if (!overlapX || !overlapY) continue;
      if (o.soort === "raam") uit.push({ ernst: "let op", kastId: k.id, tekst: `${naamKast(k)} op ${k.x} mm botst met een raam (${o.naam}).` });
      if (o.soort === "deur" || o.soort === "doorgang") uit.push({ ernst: "let op", kastId: k.id, tekst: `${naamKast(k)} op ${k.x} mm staat voor een ${o.soort}.` });
      if (o.soort === "radiator") uit.push({ ernst: "let op", kastId: k.id, tekst: `${naamKast(k)} op ${k.x} mm staat voor een radiator.` });
      if (o.soort === "stopcontact" && (k.soort === "hoog" || k.functie === "vaatwas" || k.functie === "oven")) uit.push({ ernst: "info", kastId: k.id, tekst: `Stopcontact achter ${naamKast(k)}: bereikbaar? (bv. in een aangrenzende kast).` });
    }
    const binnen = (soorten: WandObject["soort"][], marge = 300) => objecten.some((o) => soorten.includes(o.soort) && o.x + o.breedte > k.x - marge && o.x < k.x + k.breedte + marge);
    if (k.functie === "spoelbak" && !binnen(["afvoer"])) uit.push({ ernst: "let op", kastId: k.id, tekst: `Spoelbak op ${k.x} mm: geen afvoer en water in de buurt. Voeg de aansluiting toe of verplaats de spoelbak.` });
    if (k.functie === "vaatwas" && !binnen(["afvoer"], 1200)) uit.push({ ernst: "let op", kastId: k.id, tekst: `Vaatwasser op ${k.x} mm: afvoer en water binnen ± 1,2 m nodig (gewoonlijk naast de spoelbak).` });
    if (k.functie === "kookplaat" && !binnen(["elektrisch-toestel", "gas"], 600)) uit.push({ ernst: "let op", kastId: k.id, tekst: `Kookplaat op ${k.x} mm: geen aparte kring (32 A) of gasaansluiting in de buurt.` });
    if ((k.functie === "oven" || k.functie === "koelkast" || k.functie === "vaatwas") && !binnen(["stopcontact", "elektrisch-toestel"], 600)) uit.push({ ernst: "info", kastId: k.id, tekst: `${naamKast(k)} op ${k.x} mm: stopcontact of aparte kring in de buurt nakijken.` });
    if (k.functie === "dampkap" && !binnen(["dampkap-afvoer"], 600)) uit.push({ ernst: "info", kastId: k.id, tekst: "Dampkap: afvoer naar buiten of recirculatie? (bij systeem C/D ventilatie afstemmen met de ventilatie-expert)." });
  }
  return uit;
}

const NAAM_FUNCTIE: Record<KastFunctie, string> = { kast: "kast", lades: "ladekast", spoelbak: "spoelbakkast", kookplaat: "kookplaatkast", vaatwas: "vaatwasser", oven: "ovenkast", koelkast: "koelkast", dampkap: "dampkap", vulstuk: "vulstuk" };
export const naamKast = (k: Kast) => `${{ onder: "Onderkast", boven: "Bovenkast", hoog: "Hoge kast" }[k.soort]}${k.functie !== "kast" ? ` (${NAAM_FUNCTIE[k.functie]})` : ""} ${k.breedte}`;

// ---------------------------------------------------------------------------
// wandaanzicht

const KLEUR_OBJ: Partial<Record<WandObject["soort"], string>> = { koud: "#2563eb", warm: "#dc2626", afvoer: "#78716c", gas: "#ca8a04", stopcontact: "#7c3aed", "elektrisch-toestel": "#7c3aed", radiator: "#f97316", "dampkap-afvoer": "#0e7490" };

export function wandAanzicht(p: Project, w: Maatwerk, o: { geselecteerd?: string } = {}): Tekening {
  const wand = zoekWand(p, w);
  const el: TekenEl[] = [];
  if (!wand) return { titel: "Wand", elementen: el, minX: 0, maxX: 1000, minY: 0, maxY: 1000 };
  const L = wand.lengte, H = wand.hoogte;
  el.push({ t: "rect", x: 0, y: 0, b: L, h: H, vul: "#fafaf9", lijn: "#1c1917", dikte: 12 });
  for (const ob of wandObjecten(p, w, wand)) {
    if (ob.soort === "raam" || ob.soort === "deur" || ob.soort === "doorgang") {
      el.push({ t: "rect", x: ob.x, y: ob.onderkant, b: ob.breedte, h: ob.hoogte, vul: ob.soort === "raam" ? "#e0f2fe" : "#ffffff", lijn: "#0e7490", dikte: 10 });
      el.push({ t: "tekst", p: { x: ob.x + ob.breedte / 2, y: ob.onderkant + ob.hoogte + 40 }, s: `${ob.soort} ${ob.breedte}`, grootte: 70, anker: "middle", kleur: "#0e7490" });
    } else {
      el.push({ t: "rect", x: ob.x - ob.breedte / 2 + (ob.soort === "radiator" ? ob.breedte / 2 : 0), y: ob.onderkant, b: ob.breedte, h: ob.hoogte, vul: KLEUR_OBJ[ob.soort] ?? "#57534e", lijn: "#1c1917", dikte: 4 });
      el.push({ t: "tekst", p: { x: ob.x + (ob.soort === "radiator" ? ob.breedte / 2 : 0), y: ob.onderkant + ob.hoogte + 25 }, s: ob.soort === "elektrisch-toestel" ? ob.naam : ob.soort, grootte: 50, anker: "middle", kleur: KLEUR_OBJ[ob.soort] ?? "#57534e" });
    }
  }
  for (const k of w.kasten) {
    const y0 = kastOnderkant(k), h = kastHoogte(k), sel = k.id === o.geselecteerd;
    const vul = k.functie === "vulstuk" ? "#e7e5e4" : k.functie === "vaatwas" || k.functie === "oven" || k.functie === "koelkast" ? "#d6d3d1" : "#f5f5f4";
    el.push({ t: "rect", x: k.x, y: y0, b: k.breedte, h, vul: sel ? "#fde68a" : vul, lijn: sel ? "#b45309" : "#44403c", dikte: sel ? 14 : 8, data: k.id });
    if (k.soort !== "boven") el.push({ t: "rect", x: k.x, y: 0, b: k.breedte, h: MAAT.plint, vul: "#a8a29e", lijn: "#44403c", dikte: 4 });
    if (k.functie !== "vulstuk") el.push({ t: "tekst", p: { x: k.x + k.breedte / 2, y: y0 + h / 2 }, s: `${k.functie === "kast" ? "" : NAAM_FUNCTIE[k.functie] + " "}${k.breedte}`, grootte: Math.min(70, k.breedte / 6), anker: "middle", kleur: "#44403c" });
  }
  for (const s of werkblad(w)) {
    el.push({ t: "rect", x: s.van, y: MAAT.plint + MAAT.onderHoogte, b: s.lengte, h: MAAT.werkbladDikte, vul: "#292524", lijn: "#1c1917", dikte: 4 });
    for (const n of s.naden) el.push({ t: "lijn", a: { x: n, y: MAAT.plint + MAAT.onderHoogte - 30 }, b: { x: n, y: MAAT.plint + MAAT.onderHoogte + MAAT.werkbladDikte + 30 }, lijn: "#dc2626", dikte: 8 });
  }
  // maatlijn onderaan: totale lengte en kasten
  const y = -180;
  el.push({ t: "lijn", a: { x: 0, y }, b: { x: L, y }, lijn: "#b45309", dikte: 6 });
  el.push({ t: "tekst", p: { x: L / 2, y: y - 110 }, s: `${L} mm (model)${beschikbaar(w, wand).bron === "gemeten" ? ` · gemeten min. ${beschikbaar(w, wand).breedte} mm` : ""}`, grootte: 80, anker: "middle", kleur: "#b45309" });
  for (const k of rij(w, "vloer")) {
    el.push({ t: "lijn", a: { x: k.x, y: y - 40 }, b: { x: k.x, y: y + 40 }, lijn: "#b45309", dikte: 6 });
    el.push({ t: "tekst", p: { x: k.x + k.breedte / 2, y: y + 30 }, s: String(k.breedte), grootte: 55, anker: "middle", kleur: "#b45309" });
  }
  el.push({ t: "tekst", p: { x: 0, y: H + 80 }, s: `${wand.ruimte.naam} — wand ${w.rand + 1} (links → rechts gezien vanuit de ruimte)`, grootte: 90, kleur: "#1c1917", vet: true });
  const breed = Math.max(L, ...w.kasten.map((k) => k.x + k.breedte));
  return { titel: `${wand.ruimte.naam} wand ${w.rand + 1}`, elementen: el, minX: -200, maxX: breed + 200, minY: -400, maxY: H + 250 };
}

// ---------------------------------------------------------------------------
// lijsten

export interface Onderdeel { onderdeel: string; materiaal: string; lengte: number; breedte: number; dikte: number; aantal: number }

/** Snijlijst (vereenvoudigde kastopbouw in 18 mm plaat, rug 8 mm, fronten 19 mm) + werkblad, plinten, vulstukken. */
export function snijlijst(w: Maatwerk): Onderdeel[] {
  const t = MAAT.plaat, rij0: Onderdeel[] = [];
  const zet = (o: Onderdeel) => {
    const zelfde = rij0.find((x) => x.onderdeel === o.onderdeel && x.materiaal === o.materiaal && x.lengte === o.lengte && x.breedte === o.breedte && x.dikte === o.dikte);
    if (zelfde) zelfde.aantal += o.aantal; else rij0.push({ ...o });
  };
  for (const k of w.kasten) {
    const h = kastHoogte(k), d = kastDiepte(k), b = k.breedte;
    if (k.functie === "vulstuk") { zet({ onderdeel: "Vulstuk (passtuk, op maat afschrijven)", materiaal: "front", lengte: h, breedte: b + 20, dikte: 19, aantal: 1 }); continue; }
    if (k.functie === "vaatwas" || (k.functie === "koelkast" && k.soort !== "hoog")) { zet({ onderdeel: "Front voor toestel", materiaal: "front", lengte: h - 3, breedte: b - 3, dikte: 19, aantal: 1 }); continue; }
    zet({ onderdeel: "Zijpaneel", materiaal: "melamine 18", lengte: h, breedte: d, dikte: t, aantal: 2 });
    zet({ onderdeel: k.soort === "boven" ? "Bodem/top" : "Bodem", materiaal: "melamine 18", lengte: b - 2 * t, breedte: d, dikte: t, aantal: k.soort === "boven" ? 2 : 1 });
    if (k.soort !== "boven") zet({ onderdeel: "Verbinding boven (regel)", materiaal: "melamine 18", lengte: b - 2 * t, breedte: 100, dikte: t, aantal: 2 });
    zet({ onderdeel: "Rugwand", materiaal: "HDF 8", lengte: h - 10, breedte: b - 10, dikte: 8, aantal: 1 });
    if (k.functie === "kast") zet({ onderdeel: "Legplank", materiaal: "melamine 18", lengte: b - 2 * t - 2, breedte: d - 20, dikte: t, aantal: k.soort === "hoog" ? 4 : 1 });
    const deuren = k.functie === "lades" ? 3 : b > 600 ? 2 : 1;
    if (k.functie === "lades") zet({ onderdeel: "Ladefront", materiaal: "front", lengte: Math.round(h / 3) - 3, breedte: b - 3, dikte: 19, aantal: 3 });
    else zet({ onderdeel: "Deur", materiaal: "front", lengte: h - 3, breedte: Math.round(b / deuren) - 3, dikte: 19, aantal: deuren });
  }
  for (const s of werkblad(w)) {
    const grenzen = [s.van, ...s.naden, s.tot];
    for (let i = 0; i + 1 < grenzen.length; i++) zet({ onderdeel: `Werkblad${s.uitsparingen.length ? ` (uitsparingen: ${s.uitsparingen.filter((u) => u.x >= grenzen[i]! && u.x < grenzen[i + 1]!).map((u) => `${u.voor} ${Math.round(u.breedte)} × ${u.diepte}`).join(", ") || "geen"})` : ""}`, materiaal: "werkblad 38", lengte: grenzen[i + 1]! - grenzen[i]!, breedte: MAAT.werkbladDiepte, dikte: MAAT.werkbladDikte, aantal: 1 });
  }
  const plint = w.kasten.filter((k) => k.soort !== "boven").reduce((s, k) => s + k.breedte, 0);
  if (plint) zet({ onderdeel: "Plint (in één stuk of op maat)", materiaal: "plint", lengte: plint, breedte: MAAT.plint, dikte: 16, aantal: 1 });
  return rij0.filter((x) => x.aantal > 0);
}

const csvT = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export function kastenlijstCSV(p: Project, w: Maatwerk): string {
  const wand = zoekWand(p, w);
  const r = [["Nr", "Soort", "Functie", "Positie vanaf links (mm)", "Breedte", "Hoogte", "Diepte", "Onderkant boven vloer"].join(";")];
  w.kasten.slice().sort((a, b) => (a.soort === b.soort ? a.x - b.x : a.soort.localeCompare(b.soort))).forEach((k, i) => r.push([i + 1, k.soort, k.functie, k.x, k.breedte, kastHoogte(k), kastDiepte(k), kastOnderkant(k)].join(";")));
  r.push("");
  r.push(["Werkblad van", "tot", "lengte", "naden op", "uitsparingen"].join(";"));
  for (const s of werkblad(w)) r.push([s.van, s.tot, s.lengte, s.naden.join(" "), csvT(s.uitsparingen.map((u) => `${u.voor} ${Math.round(u.breedte)}×${u.diepte} op ${Math.round(u.x)}`).join(", "))].join(";"));
  r.push("");
  r.push(["Snijlijst: onderdeel", "materiaal", "lengte", "breedte", "dikte", "aantal"].join(";"));
  for (const o of snijlijst(w)) r.push([csvT(o.onderdeel), o.materiaal, o.lengte, o.breedte, o.dikte, o.aantal].join(";"));
  r.push("");
  if (wand) r.push(csvT(`Wand: ${wand.ruimte.naam}, rand ${w.rand + 1}; lengte model ${wand.lengte} mm; beschikbaar ${beschikbaar(w, wand).breedte} mm (${beschikbaar(w, wand).bron}).`));
  r.push(csvT("Vereenvoudigde kastopbouw (18 mm plaat, rug 8 mm, fronten 19 mm, 3 mm voeg). De keukenbouwer bepaalt beslag, opbouw en toleranties."));
  r.push(csvT(KEUKEN_DISCLAIMER));
  return "﻿" + r.join("\r\n") + "\r\n";
}

/** Wandaanzicht als DXF (R12), in mm: lagen WAND, OPENINGEN, KASTEN, WERKBLAD, AANSLUITINGEN, TEKST. */
export function wandAanzichtDXF(p: Project, w: Maatwerk): string {
  const t = wandAanzicht(p, w);
  const d = new Dxf();
  d.g(0, "SECTION"); d.g(2, "HEADER"); d.g(9, "$ACADVER"); d.g(1, "AC1009"); d.g(9, "$INSUNITS"); d.g(70, 4); d.g(0, "ENDSEC");
  const lagen: Record<string, number> = { WAND: 7, OPENINGEN: 4, KASTEN: 8, WERKBLAD: 1, AANSLUITINGEN: 6, TEKST: 3, MATEN: 2 };
  d.g(0, "SECTION"); d.g(2, "TABLES"); d.g(0, "TABLE"); d.g(2, "LAYER"); d.g(70, Object.keys(lagen).length);
  for (const [n, k] of Object.entries(lagen)) { d.g(0, "LAYER"); d.g(2, n); d.g(70, 0); d.g(62, k); d.g(6, "CONTINUOUS"); }
  d.g(0, "ENDTAB"); d.g(0, "ENDSEC");
  d.g(0, "SECTION"); d.g(2, "ENTITIES");
  t.elementen.forEach((e, i) => {
    if (e.t === "rect") {
      const laag = i === 0 ? "WAND" : e.data ? "KASTEN" : e.vul === "#292524" ? "WERKBLAD" : e.lijn === "#0e7490" ? "OPENINGEN" : e.vul === "#a8a29e" ? "KASTEN" : "AANSLUITINGEN";
      d.polylijn(laag, [{ x: e.x, y: e.y }, { x: e.x + e.b, y: e.y }, { x: e.x + e.b, y: e.y + e.h }, { x: e.x, y: e.y + e.h }]);
    } else if (e.t === "lijn") d.lijn(e.lijn === "#dc2626" ? "WERKBLAD" : "MATEN", e.a, e.b);
    else d.tekst("TEKST", e.p, e.grootte, e.s.replace(/[^\x20-\x7e]/g, (c) => (c === "×" ? "x" : c === "→" ? "->" : c === "—" ? "-" : "?")));
  });
  d.g(0, "ENDSEC"); d.g(0, "EOF");
  return d.toString();
}
