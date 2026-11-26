/**
 * Van aangetikte hoekpunten (camera/AR) naar een ruimte.
 *
 * De punten zijn de BINNENhoeken van de ruimte op de vloer, in volgorde rond
 * de ruimte, in mm (x naar rechts, y naar voren). Ze zijn onnauwkeurig: de
 * hoeken zijn nooit precies 90°. `haaksMaken` maakt er een haaks plan van;
 * `projectUitHoekpunten` zet er muren rond met de opgegeven dikte.
 */
import { aansluitingen, muurLengte } from "./geometrie.ts";
import { Project, SCHEMA_VERSIE, type Bron, type Muur, type Punt, type Verdieping } from "./schema.ts";
import { voegRuimteToe } from "./uitbreiden.ts";

export interface HaaksResultaat {
  punten: Punt[];
  /** Grootste afwijking (graden) van een muur t.o.v. haaks, vóór het rechtzetten. */
  maxAfwijking: number;
}

const MAX_AFWIJKING = 20; // graden: meer → waarschijnlijk echt een schuine muur of een tikfout

/**
 * Zet een veelhoek recht: eerste muur horizontaal, elke muur horizontaal of
 * verticaal. Opeenvolgende muren in dezelfde richting worden samengevoegd.
 * Gooit een fout als een muur meer dan 20° van haaks afwijkt.
 */
export function haaksMaken(invoer: Punt[]): HaaksResultaat {
  const pts = ontdubbel(invoer);
  if (pts.length < 3) throw new Error("Tik minstens 3 hoeken aan (bij een rechthoek: 4).");
  const p0 = pts[0]!, p1 = pts[1]!;
  const hoek0 = Math.atan2(p1.y - p0.y, p1.x - p0.x);
  const cos = Math.cos(-hoek0), sin = Math.sin(-hoek0);
  const rot = pts.map((p) => ({ x: (p.x - p0.x) * cos - (p.y - p0.y) * sin, y: (p.x - p0.x) * sin + (p.y - p0.y) * cos }));

  // richting per muur
  type Muurtje = { h: boolean; punten: Punt[] };
  let maxAfwijking = 0;
  const muren: Muurtje[] = rot.map((a, i) => {
    const b = rot[(i + 1) % rot.length]!;
    const graden = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    const h = Math.abs(Math.cos((graden * Math.PI) / 180)) >= Math.abs(Math.sin((graden * Math.PI) / 180));
    const afw = h ? Math.min(Math.abs(graden), 180 - Math.abs(graden)) : Math.abs(90 - Math.abs(graden));
    maxAfwijking = Math.max(maxAfwijking, afw);
    return { h, punten: [a, b] };
  });
  if (maxAfwijking > MAX_AFWIJKING)
    throw new Error(`Een muur wijkt ${Math.round(maxAfwijking)}° af van haaks. Zet "Haaks maken" uit om schuine muren te behouden, of tik de hoeken opnieuw aan.`);

  // opeenvolgende muren met dezelfde richting samenvoegen (ook rond het begin)
  const samengevoegd: Muurtje[] = [];
  for (const m of muren) {
    const laatste = samengevoegd[samengevoegd.length - 1];
    if (laatste && laatste.h === m.h) laatste.punten.push(...m.punten);
    else samengevoegd.push({ h: m.h, punten: [...m.punten] });
  }
  if (samengevoegd.length > 1 && samengevoegd[0]!.h === samengevoegd[samengevoegd.length - 1]!.h) {
    const laatste = samengevoegd.pop()!;
    samengevoegd[0]!.punten.push(...laatste.punten);
  }
  if (samengevoegd.length < 4 || samengevoegd.length % 2)
    throw new Error("Deze hoeken vormen geen gesloten haaks plan. Tik de hoeken in volgorde rond de ruimte aan.");

  // elke muur = lijn (y = gemiddelde voor horizontaal, x = gemiddelde voor verticaal)
  const lijn = samengevoegd.map((m) => {
    const w = m.punten.map((p) => (m.h ? p.y : p.x));
    return w.reduce((s, x) => s + x, 0) / w.length;
  });
  // hoek i = snijpunt van muur i−1 en muur i
  const hoeken: Punt[] = samengevoegd.map((m, i) => {
    const vorige = (i - 1 + samengevoegd.length) % samengevoegd.length;
    return m.h ? { x: lijn[vorige]!, y: lijn[i]! } : { x: lijn[i]!, y: lijn[vorige]! };
  });
  const minX = Math.min(...hoeken.map((p) => p.x)), minY = Math.min(...hoeken.map((p) => p.y));
  let punten = hoeken.map((p) => ({ x: Math.round(p.x - minX), y: Math.round(p.y - minY) }));
  if (teken(punten) < 0) punten = punten.reverse();
  return { punten, maxAfwijking };
}

export interface UitHoekpunten {
  naam: string;
  ruimteNaam?: string;
  muurdikte: number;
  plafondhoogte: number;
  /** Geschatte onzekerheid van de punten (±mm). */
  nauwkeurigheidMm?: number;
  toestel?: string;
  nu?: string;
}

/** Verdieping met één ruimte en muren rond de (binnen)hoekpunten. */
export function verdiepingUitHoekpunten(binnen: Punt[], i: UitHoekpunten, id = "v0"): Verdieping {
  let c = binnen.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
  if (teken(c) < 0) c = c.reverse();
  if (c.length < 3) throw new Error("Minstens 3 hoekpunten nodig.");
  const h = i.muurdikte / 2;
  const bron: Bron = { methode: "gescand", nauwkeurigheidMm: i.nauwkeurigheidMm ?? 50, toestel: i.toestel, tijdstip: i.nu };
  // hartlijn van elke muur = binnenrand een halve muurdikte naar buiten (rechts van de rijrichting bij tegen-de-klok)
  const lijnen = c.map((a, k) => {
    const b = c[(k + 1) % c.length]!;
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    const n = { x: (b.y - a.y) / L, y: -(b.x - a.x) / L };
    return { a: { x: a.x + n.x * h, y: a.y + n.y * h }, b: { x: b.x + n.x * h, y: b.y + n.y * h } };
  });
  const hoeken = lijnen.map((l, k) => snij(lijnen[(k - 1 + lijnen.length) % lijnen.length]!, l));
  const muren: Muur[] = hoeken.map((s, k) => ({
    id: `m-${k + 1}@${id}`,
    start: { x: Math.round(s.x), y: Math.round(s.y) },
    eind: { x: Math.round(hoeken[(k + 1) % hoeken.length]!.x), y: Math.round(hoeken[(k + 1) % hoeken.length]!.y) },
    dikte: Math.round(i.muurdikte),
    hoogte: Math.round(i.plafondhoogte),
    dragend: "onbekend",
    bron,
  }));
  return {
    id, naam: "Gelijkvloers", peil: 0, muren, openingen: [], sparingen: [], installaties: [], meubels: [],
    ruimtes: [{ id: `r-1@${id}`, naam: i.ruimteNaam ?? "Ruimte 1", contour: c, plafondhoogte: Math.round(i.plafondhoogte), muurIds: muren.map((m) => m.id), bron }],
  };
}

export function projectUitHoekpunten(binnen: Punt[], i: UitHoekpunten): Project {
  const nu = i.nu ?? new Date().toISOString();
  return Project.parse({
    schemaVersie: SCHEMA_VERSIE,
    id: `prj-${Date.parse(nu).toString(36)}`,
    naam: i.naam,
    aangemaakt: nu,
    gewijzigd: nu,
    verdiepingen: [verdiepingUitHoekpunten(binnen, { ...i, nu })],
  });
}

function snij(l1: { a: Punt; b: Punt }, l2: { a: Punt; b: Punt }): Punt {
  const d1 = { x: l1.b.x - l1.a.x, y: l1.b.y - l1.a.y }, d2 = { x: l2.b.x - l2.a.x, y: l2.b.y - l2.a.y };
  const det = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(det) < 1e-9) return l2.a; // evenwijdig: gebruik het begin van de volgende muur
  const t = ((l2.a.x - l1.a.x) * d2.y - (l2.a.y - l1.a.y) * d2.x) / det;
  return { x: l1.a.x + d1.x * t, y: l1.a.y + d1.y * t };
}

function teken(c: Punt[]): number {
  let s = 0;
  for (let k = 0; k < c.length; k++) {
    const a = c[k]!, b = c[(k + 1) % c.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return s;
}

/** Laat punten weg die (bijna) samenvallen met het vorige: dubbel getikt. */
function ontdubbel(pts: Punt[], min = 50): Punt[] {
  const uit: Punt[] = [];
  for (const p of pts) {
    const v = uit[uit.length - 1];
    if (!v || Math.hypot(p.x - v.x, p.y - v.y) >= min) uit.push(p);
  }
  if (uit.length > 1 && Math.hypot(uit[0]!.x - uit[uit.length - 1]!.x, uit[0]!.y - uit[uit.length - 1]!.y) < min) uit.pop();
  return uit;
}

// ---------------------------------------------------------------------------
// Camera-opmeting verfijnd: schuine muren behouden, meerdere ruimtes na elkaar.

export interface DeelsHaaks {
  punten: Punt[];
  /** Grootste afwijking (graden) van de muren die haaks gezet zijn. */
  maxAfwijking: number;
  /** Aantal muren dat schuin blijft. */
  schuin: number;
}

/** Draai rond de oorsprong. */
const draai = (p: Punt, a: number): Punt => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) });

/**
 * Haaks maken waar het kan: een muur die minder dan `tolerantie` graden van
 * horizontaal/verticaal afwijkt wordt haaks gezet, de andere muren blijven
 * schuin (lijn door hun twee hoeken). Punten moeten al gedraaid zijn zodat de
 * eerste muur ongeveer horizontaal ligt. Geen verschuiving naar (0,0).
 */
function deelsHaaksIntern(pts: Punt[], tolerantie: number): DeelsHaaks {
  type Rand = { soort: "h" | "v" | "s"; punten: Punt[] };
  let maxAfwijking = 0, schuin = 0;
  const randen: Rand[] = pts.map((a, i) => {
    const b = pts[(i + 1) % pts.length]!;
    const g = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    const h = Math.min(Math.abs(g), 180 - Math.abs(g)), v = Math.abs(90 - Math.abs(g));
    if (Math.min(h, v) <= tolerantie) {
      maxAfwijking = Math.max(maxAfwijking, Math.min(h, v));
      return { soort: h <= v ? "h" : "v", punten: [a, b] };
    }
    schuin++;
    return { soort: "s", punten: [a, b] };
  });
  const samen: Rand[] = [];
  for (const r of randen) {
    const l = samen[samen.length - 1];
    if (l && l.soort !== "s" && l.soort === r.soort) l.punten.push(...r.punten);
    else samen.push({ soort: r.soort, punten: [...r.punten] });
  }
  if (samen.length > 1 && samen[0]!.soort !== "s" && samen[0]!.soort === samen[samen.length - 1]!.soort) samen[0]!.punten.push(...samen.pop()!.punten);
  if (samen.length < 3) throw new Error("Deze hoeken vormen geen ruimte. Tik de hoeken in volgorde rond de ruimte aan.");
  const lijnen = samen.map((r) => {
    if (r.soort === "s") {
      const a = r.punten[0]!, b = r.punten[r.punten.length - 1]!, L = Math.hypot(b.x - a.x, b.y - a.y);
      return { p: a, d: { x: (b.x - a.x) / L, y: (b.y - a.y) / L } };
    }
    const gem = r.punten.reduce((s, q) => ({ x: s.x + q.x / r.punten.length, y: s.y + q.y / r.punten.length }), { x: 0, y: 0 });
    return { p: gem, d: r.soort === "h" ? { x: 1, y: 0 } : { x: 0, y: 1 } };
  });
  const punten = lijnen.map((l, i) => {
    const k = lijnen[(i - 1 + lijnen.length) % lijnen.length]!;
    const det = k.d.x * l.d.y - k.d.y * l.d.x;
    if (Math.abs(det) < 1e-6) return l.p;
    const t = ((l.p.x - k.p.x) * l.d.y - (l.p.y - k.p.y) * l.d.x) / det;
    return { x: k.p.x + k.d.x * t, y: k.p.y + k.d.y * t };
  });
  return { punten, maxAfwijking, schuin };
}

/** Publieke versie: draait zelf, verschuift naar (0,0), tegen de klok in. */
export function haaksWaarHetKan(invoer: Punt[], tolerantie = 8): DeelsHaaks {
  const pts = ontdubbel(invoer);
  if (pts.length < 3) throw new Error("Tik minstens 3 hoeken aan (bij een rechthoek: 4).");
  const a = -Math.atan2(pts[1]!.y - pts[0]!.y, pts[1]!.x - pts[0]!.x);
  const r = deelsHaaksIntern(pts.map((p) => draai({ x: p.x - pts[0]!.x, y: p.y - pts[0]!.y }, a)), tolerantie);
  return { ...r, punten: normaliseer(r.punten) };
}

function normaliseer(c: Punt[]): Punt[] {
  const mx = Math.min(...c.map((p) => p.x)), my = Math.min(...c.map((p) => p.y));
  let uit = c.map((p) => ({ x: Math.round(p.x - mx), y: Math.round(p.y - my) }));
  if (teken(uit) < 0) uit = uit.reverse();
  return uit;
}

export interface CameraKamer {
  naam: string;
  punten: Punt[];
  /** Plafondhoogte (mm), gemeten met de camera of ingegeven. */
  plafondhoogte: number;
}

export interface CameraOpties {
  naam: string;
  muurdikte: number;
  /** Graden: muren die minder afwijken worden haaks gezet. 0 = alles zoals gemeten. */
  tolerantie: number;
  nauwkeurigheidMm?: number;
  toestel?: string;
  nu?: string;
}

/**
 * Meerdere ruimtes uit één camera-sessie (zelfde assenstelsel). De eerste
 * ruimte mag elke vorm hebben; elke volgende ruimte moet (na haaks maken)
 * rechthoekig zijn en tegen een buitenmuur van de vorige liggen: ze wordt
 * erbij gezet met dezelfde logica als "Ruimte hiernaast toevoegen" (de muur
 * wordt tussenmuur).
 */
export function projectUitCamera(kamers: CameraKamer[], o: CameraOpties): { project: Project; meldingen: string[] } {
  if (!kamers.length) throw new Error("Geen ruimtes opgemeten.");
  const nu = o.nu ?? new Date().toISOString();
  const meldingen: string[] = [];
  const eerste = ontdubbel(kamers[0]!.punten);
  if (eerste.length < 3) throw new Error("Tik minstens 3 hoeken aan (bij een rechthoek: 4).");
  const oorsprong = eerste[0]!;
  const a = -Math.atan2(eerste[1]!.y - oorsprong.y, eerste[1]!.x - oorsprong.x);
  const zet = (pts: Punt[]) => ontdubbel(pts).map((p) => draai({ x: p.x - oorsprong.x, y: p.y - oorsprong.y }, a));
  const vorm = (pts: Punt[]) => (o.tolerantie > 0 ? deelsHaaksIntern(pts, o.tolerantie) : { punten: pts, maxAfwijking: 0, schuin: pts.length });

  const k0 = vorm(zet(kamers[0]!.punten));
  if (o.tolerantie > 0) meldingen.push(k0.schuin ? `${kamers[0]!.naam}: ${k0.schuin} muur/muren schuin gelaten (afwijking > ${o.tolerantie}°).` : `${kamers[0]!.naam}: haaks gemaakt (grootste afwijking ${k0.maxAfwijking.toFixed(1)}°).`);
  // alles verschuiven zodat de eerste ruimte bij (0,0) begint
  const mx = Math.min(...k0.punten.map((p) => p.x)), my = Math.min(...k0.punten.map((p) => p.y));
  const T = (p: Punt): Punt => ({ x: Math.round(p.x - mx), y: Math.round(p.y - my) });
  let c0 = k0.punten.map(T);
  if (teken(c0) < 0) c0 = c0.reverse();
  const bronIn = { nauwkeurigheidMm: o.nauwkeurigheidMm ?? 50, toestel: o.toestel, nu };
  let v = verdiepingUitHoekpunten(c0, { naam: o.naam, ruimteNaam: kamers[0]!.naam, muurdikte: o.muurdikte, plafondhoogte: kamers[0]!.plafondhoogte, ...bronIn });

  for (const k of kamers.slice(1)) {
    let r: DeelsHaaks;
    try { r = deelsHaaksIntern(zet(k.punten), Math.max(o.tolerantie, 8)); } catch (e) { meldingen.push(`${k.naam} overgeslagen: ${(e as Error).message}`); continue; }
    const c = r.punten.map(T);
    if (c.length !== 4 || r.schuin) { meldingen.push(`${k.naam} overgeslagen: een volgende ruimte moet (nog) rechthoekig zijn. Voeg ze toe met "Ruimte hiernaast toevoegen".`); continue; }
    const x0 = Math.min(...c.map((p) => p.x)), x1 = Math.max(...c.map((p) => p.x)), y0 = Math.min(...c.map((p) => p.y)), y1 = Math.max(...c.map((p) => p.y));
    // beste buitenmuur: evenwijdig, binnenvlak van de nieuwe ruimte op ± dikte/2 van de hartlijn
    let beste: { m: Muur; fout: number; lo: number; hi: number; diepte: number } | null = null;
    for (const m of v.muren) {
      if (v.ruimtes.filter((x) => x.muurIds.includes(m.id)).length !== 1) continue;
      const hor = m.start.y === m.eind.y, ver = m.start.x === m.eind.x;
      if (!hor && !ver) continue;
      const lijn = hor ? m.start.y : m.start.x;
      const [lo, hi] = hor ? [x0, x1] : [y0, y1];
      const [vlo, vhi] = hor ? [y0, y1] : [x0, x1];
      const kant = Math.abs(vlo - (lijn + m.dikte / 2)) < Math.abs(vhi - (lijn - m.dikte / 2)) ? vlo - (lijn + m.dikte / 2) : vhi - (lijn - m.dikte / 2);
      const fout = Math.abs(kant);
      const mlo = Math.min(hor ? m.start.x : m.start.y, hor ? m.eind.x : m.eind.y), mhi = Math.max(hor ? m.start.x : m.start.y, hor ? m.eind.x : m.eind.y);
      if (hi <= mlo || lo >= mhi) continue;
      if (fout < 250 && (!beste || fout < beste.fout)) beste = { m, fout, lo, hi, diepte: vhi - vlo };
    }
    if (!beste) { meldingen.push(`${k.naam} overgeslagen: ligt niet tegen een buitenmuur van de vorige ruimtes (meet de hoeken aan de kant van die muur opnieuw, of voeg de ruimte toe met "Ruimte hiernaast toevoegen").`); continue; }
    const m = beste.m;
    const L = muurLengte(m), u = { x: (m.eind.x - m.start.x) / L, y: (m.eind.y - m.start.y) / L };
    const hor = m.start.y === m.eind.y;
    const t = (w: number) => (hor ? (w - m.start.x) * u.x : (w - m.start.y) * u.y);
    const t1 = Math.min(t(beste.lo), t(beste.hi)), t2 = Math.max(t(beste.lo), t(beste.hi));
    const aans = aansluitingen(m, v.muren);
    const binnen = L - aans.start - aans.eind;
    let a0 = t1 - aans.start, B = t2 - t1;
    if (a0 < 0) { B += a0; a0 = 0; }
    if (a0 + B > binnen) B = binnen - a0;
    if (B < 300) { meldingen.push(`${k.naam} overgeslagen: te weinig overlap met de muur.`); continue; }
    if (Math.abs(B - (t2 - t1)) > 50) meldingen.push(`${k.naam}: breedte ingekort tot ${Math.round(B)} mm (paste niet langs de muur).`);
    const voor = new Set([...v.muren.map((x) => x.id), ...v.ruimtes.map((x) => x.id)]);
    try {
      v = voegRuimteToe(v, { muurId: m.id, naam: k.naam, breedte: Math.round(B), diepte: Math.round(beste.diepte), afstandVanafA: Math.round(a0), plafondhoogte: k.plafondhoogte, muurdikte: o.muurdikte });
    } catch (e) { meldingen.push(`${k.naam} overgeslagen: ${(e as Error).message}`); continue; }
    // nieuwe muren en ruimte zijn gescand, niet manueel
    const bron: Bron = { methode: "gescand", nauwkeurigheidMm: bronIn.nauwkeurigheidMm, toestel: o.toestel, tijdstip: nu };
    v = { ...v, muren: v.muren.map((x) => (voor.has(x.id) ? x : { ...x, bron })), ruimtes: v.ruimtes.map((x) => (voor.has(x.id) ? x : { ...x, bron })) };
    meldingen.push(`${k.naam}: geplaatst tegen de bestaande muur (afwijking ${Math.round(beste.fout)} mm).`);
  }
  const project = Project.parse({ schemaVersie: SCHEMA_VERSIE, id: `prj-${Date.parse(nu).toString(36)}`, naam: o.naam, aangemaakt: nu, gewijzigd: nu, verdiepingen: [v] });
  return { project, meldingen };
}
