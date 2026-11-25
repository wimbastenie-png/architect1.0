/**
 * Van aangetikte hoekpunten (camera/AR) naar een ruimte.
 *
 * De punten zijn de BINNENhoeken van de ruimte op de vloer, in volgorde rond
 * de ruimte, in mm (x naar rechts, y naar voren). Ze zijn onnauwkeurig: de
 * hoeken zijn nooit precies 90°. `haaksMaken` maakt er een haaks plan van;
 * `projectUitHoekpunten` zet er muren rond met de opgegeven dikte.
 */
import { Project, SCHEMA_VERSIE, type Bron, type Muur, type Punt, type Verdieping } from "./schema.ts";

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
    throw new Error(`Een muur wijkt ${Math.round(maxAfwijking)}° af van haaks. Schuine muren worden nog niet ondersteund; tik de hoeken opnieuw aan.`);

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
    id, naam: "Gelijkvloers", peil: 0, muren, openingen: [], sparingen: [],
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
