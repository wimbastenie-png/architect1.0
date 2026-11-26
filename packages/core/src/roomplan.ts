/**
 * RoomPlan-omzetting: een scan van een iPhone/iPad Pro met LiDAR (Apple
 * RoomPlan, `CapturedRoom` als JSON bewaard) → projectformaat.
 *
 * Wat RoomPlan levert (in meter, ARKit-wereld: y omhoog):
 * - walls/doors/windows/openings: elk een `transform` (4×4, kolomsgewijs) en
 *   `dimensions` [breedte, hoogte, diepte]. De lokale x-as loopt langs het vlak.
 * - muren zijn vlakken (diepte 0) op de zichtbare binnenkant; de dikte ziet de
 *   scanner niet: die geef je zelf op.
 * - deuren en ramen kennen hun muur via `parentIdentifier` (iOS 17+); anders
 *   zoeken we de dichtste muur.
 *
 * Werkwijze: de muurvlakken worden in volgorde rond de ruimte gezet; elke
 * binnenhoek = snijpunt van twee opeenvolgende muurvlakken. Zo ontstaat de
 * binnencontour; de muren eromheen krijgen de opgegeven dikte (zoals bij de
 * camera-opmeting). Eén ruimte per scan.
 */
import { haaksMaken, verdiepingUitHoekpunten } from "./hoekpunten.ts";
import { Project, SCHEMA_VERSIE, type Opening, type Punt } from "./schema.ts";

interface Vlak {
  identifier?: string;
  parentIdentifier?: string | null;
  transform: number[];
  dimensions: number[];
  category?: Record<string, unknown>;
}

export interface RoomPlanInvoer {
  walls: Vlak[];
  doors?: Vlak[];
  windows?: Vlak[];
  openings?: Vlak[];
  objects?: unknown[];
}

export interface RoomPlanOpties {
  naam?: string;
  ruimteNaam?: string;
  /** Muurdikte in mm (RoomPlan meet die niet). */
  muurdikte?: number;
  /** Haaks rechtzetten als alle muren minder dan `haaksTot` graden afwijken. Standaard 3°. 0 = nooit. */
  haaksTot?: number;
  nu?: string;
}

export interface RoomPlanResultaat {
  project: Project;
  meldingen: string[];
}

/** Is dit JSON waarschijnlijk een RoomPlan-scan? */
export function isRoomPlan(data: unknown): data is RoomPlanInvoer {
  if (!data || typeof data !== "object") return false;
  const w = (data as { walls?: unknown }).walls;
  return Array.isArray(w) && w.length > 0 && w.every((x) => x && typeof x === "object" && Array.isArray((x as Vlak).transform) && (x as Vlak).transform.length === 16 && Array.isArray((x as Vlak).dimensions));
}

interface Lijn { id?: string; c: Punt; u: Punt; w: number; h: number; y0: number }

/** Plancoördinaten in mm: x = wereld-x, y = −wereld-z (bovenaanzicht, y naar voren). */
function lijnVan(v: Vlak): Lijn {
  const t = v.transform;
  const ux = t[0]!, uz = t[2]!;
  const L = Math.hypot(ux, uz) || 1;
  const w = (v.dimensions[0] ?? 0) * 1000, h = (v.dimensions[1] ?? 0) * 1000;
  return {
    id: v.identifier,
    c: { x: t[12]! * 1000, y: -t[14]! * 1000 },
    u: { x: ux / L, y: -uz / L },
    w,
    h,
    y0: t[13]! * 1000 - h / 2,
  };
}

function draai(l: Lijn, a: number): Lijn {
  const c = Math.cos(a), s = Math.sin(a);
  const r = (p: Punt) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c });
  return { ...l, c: r(l.c), u: r(l.u) };
}

const eind = (l: Lijn, s: 1 | -1): Punt => ({ x: l.c.x + (l.u.x * l.w * s) / 2, y: l.c.y + (l.u.y * l.w * s) / 2 });
const afst = (a: Punt, b: Punt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Zet de muren in volgorde rond de ruimte (eindpunt → dichtste beginpunt). */
function orden(lijnen: Lijn[]): Array<{ l: Lijn; omgekeerd: boolean }> {
  const over = lijnen.slice(1);
  const uit = [{ l: lijnen[0]!, omgekeerd: false }];
  while (over.length) {
    const vorig = uit[uit.length - 1]!;
    const p = eind(vorig.l, vorig.omgekeerd ? -1 : 1);
    let beste = -1, omg = false, d = Infinity;
    over.forEach((l, i) => {
      const a = afst(p, eind(l, -1)), b = afst(p, eind(l, 1));
      if (a < d) { d = a; beste = i; omg = false; }
      if (b < d) { d = b; beste = i; omg = true; }
    });
    if (d > 600) throw new Error(`De muren sluiten niet aan (gat van ${Math.round(d)} mm). Scan de ruimte volledig rond, of meet ze met de rolmeter.`);
    uit.push({ l: over.splice(beste, 1)[0]!, omgekeerd: omg });
  }
  const sluit = afst(eind(uit[uit.length - 1]!.l, uit[uit.length - 1]!.omgekeerd ? -1 : 1), eind(uit[0]!.l, -1));
  if (sluit > 600) throw new Error(`De scan is geen gesloten ruimte (gat van ${Math.round(sluit)} mm tussen de laatste en de eerste muur).`);
  return uit;
}

export function roomPlanNaarProject(data: RoomPlanInvoer, o: RoomPlanOpties = {}): RoomPlanResultaat {
  const meldingen: string[] = [];
  const dikte = o.muurdikte ?? 200;
  const nu = o.nu ?? new Date().toISOString();
  if (!data.walls?.length || data.walls.length < 3) throw new Error("De scan bevat minder dan 3 muren.");
  // alles draaien zodat de eerste muur horizontaal ligt (zelfde assenstelsel voor muren én openingen)
  const ruw = data.walls.map((x) => lijnVan(x)).filter((l) => l.w > 50);
  if (ruw.length < 3) throw new Error("De scan bevat minder dan 3 muren.");
  const hoek = -Math.atan2(ruw[0]!.u.y, ruw[0]!.u.x);
  const lijnen = ruw.map((l) => draai(l, hoek));
  const volgorde = orden(lijnen);

  // hoek tussen muur i−1 en muur i; (bijna) evenwijdige opeenvolgende stukken = één muur
  const richt = volgorde.map(({ l, omgekeerd }) => (omgekeerd ? { x: -l.u.x, y: -l.u.y } : l.u));
  const hoeken: Punt[] = [];
  for (let i = 0; i < volgorde.length; i++) {
    const j = (i - 1 + volgorde.length) % volgorde.length;
    const a = volgorde[j]!.l, b = volgorde[i]!.l, da = richt[j]!, db = richt[i]!;
    const k = da.x * db.y - da.y * db.x;
    if (Math.abs(k) < Math.sin((5 * Math.PI) / 180)) continue; // doorlopende muur
    const t = ((b.c.x - a.c.x) * db.y - (b.c.y - a.c.y) * db.x) / k;
    hoeken.push({ x: a.c.x + da.x * t, y: a.c.y + da.y * t });
  }
  if (hoeken.length < 3) throw new Error("Uit deze muren kan geen ruimte gevormd worden.");

  // haaks rechtzetten als de afwijking klein is (meetruis)
  let contour = hoeken;
  const grens = o.haaksTot ?? 3;
  if (grens > 0) {
    try {
      const r = haaksMaken(hoeken);
      if (r.maxAfwijking <= grens && r.punten.length === hoeken.length) {
        // haaksMaken verschuift naar (0,0) en kan omkeren: terugzetten op dezelfde plaats
        const minX = Math.min(...hoeken.map((p) => p.x)), minY = Math.min(...hoeken.map((p) => p.y));
        contour = r.punten.map((p) => ({ x: p.x + minX, y: p.y + minY }));
        meldingen.push(`Haaks rechtgezet (grootste afwijking ${r.maxAfwijking.toFixed(1)}°).`);
      } else if (r.maxAfwijking > grens) meldingen.push(`Niet haaks rechtgezet: een muur wijkt ${r.maxAfwijking.toFixed(1)}° af (schuine muur?).`);
    } catch {
      meldingen.push("Niet haaks rechtgezet (schuine muren).");
    }
  }

  // tegen de klok in
  let opp = 0;
  for (let k = 0; k < contour.length; k++) { const a = contour[k]!, b = contour[(k + 1) % contour.length]!; opp += a.x * b.y - b.x * a.y; }
  if (opp < 0) contour = [...contour].reverse();
  // naar positieve coördinaten
  const mx = Math.min(...contour.map((p) => p.x)), my = Math.min(...contour.map((p) => p.y));
  contour = contour.map((p) => ({ x: Math.round(p.x - mx), y: Math.round(p.y - my) }));
  const verschuif = (p: Punt): Punt => ({ x: p.x - mx, y: p.y - my });

  const vloer = Math.min(...lijnen.map((l) => l.y0));
  const hoogte = Math.round(Math.max(...lijnen.map((l) => l.h)) / 10) * 10;
  const v = verdiepingUitHoekpunten(contour, {
    naam: o.naam ?? "RoomPlan-scan",
    ruimteNaam: o.ruimteNaam ?? "Ruimte 1",
    muurdikte: dikte,
    plafondhoogte: hoogte,
    nauwkeurigheidMm: 30,
    toestel: "iPhone/iPad (RoomPlan)",
    nu,
  });

  // binnenrand van muur k = contour[k] → contour[k+1]
  const randen = contour.map((a, k) => ({ a, b: contour[(k + 1) % contour.length]!, muur: v.muren[k]! }));
  const openingen: Opening[] = [];
  const soorten: Array<[Vlak[] | undefined, Opening["soort"]]> = [[data.doors, "deur"], [data.windows, "raam"], [data.openings, "doorgang"]];
  let n = 0;
  for (const [lijst, soort] of soorten) {
    for (const vl of lijst ?? []) {
      const l = draai(lijnVan(vl), hoek);
      const c = verschuif(l.c);
      // dichtste binnenrand
      let beste: (typeof randen)[number] | null = null, d = Infinity, tBeste = 0, Lb = 0;
      for (const r of randen) {
        const L = afst(r.a, r.b), u = { x: (r.b.x - r.a.x) / L, y: (r.b.y - r.a.y) / L };
        const t = (c.x - r.a.x) * u.x + (c.y - r.a.y) * u.y;
        const tt = Math.max(0, Math.min(L, t));
        const q = { x: r.a.x + u.x * tt, y: r.a.y + u.y * tt };
        const dd = afst(q, c);
        const evenwijdig = Math.abs(u.x * l.u.y - u.y * l.u.x) < 0.2;
        if (evenwijdig && dd < d) { d = dd; beste = r; tBeste = t; Lb = L; }
      }
      if (!beste || d > 500) { meldingen.push(`${soort === "raam" ? "Raam" : soort === "deur" ? "Deur" : "Doorgang"} van ${Math.round(l.w)} mm niet aan een muur gekoppeld (overgeslagen).`); continue; }
      const m = beste.muur;
      // offset langs de hartlijn: de binnenrand begint dikte/2 verder dan het hartlijnbegin bij een haakse hoek
      const Lm = Math.hypot(m.eind.x - m.start.x, m.eind.y - m.start.y);
      const um = { x: (m.eind.x - m.start.x) / Lm, y: (m.eind.y - m.start.y) / Lm };
      const tHart = (beste.a.x - m.start.x) * um.x + (beste.a.y - m.start.y) * um.y + tBeste;
      const breedte = Math.round(Math.min(l.w, Lb));
      let offset = Math.round(tHart - breedte / 2);
      offset = Math.max(0, Math.min(Math.round(Lm) - breedte, offset));
      const borstwering = soort === "raam" ? Math.max(0, Math.round(l.y0 - vloer)) : 0;
      openingen.push({
        id: `o-${++n}@${v.id}`,
        muurId: m.id,
        soort,
        offset,
        breedte,
        hoogte: Math.max(1, Math.round(Math.min(l.h, m.hoogte - borstwering))),
        borstwering,
        bron: { methode: "gescand", nauwkeurigheidMm: 30, toestel: "iPhone/iPad (RoomPlan)", tijdstip: nu },
      });
    }
  }
  if (data.objects?.length) meldingen.push(`${data.objects.length} meubels/toestellen in de scan worden (nog) niet overgenomen.`);
  meldingen.push(`Muurdikte ${dikte} mm aangenomen (de scanner meet geen dikte): pas aan per muur.`);

  const project = Project.parse({
    schemaVersie: SCHEMA_VERSIE,
    id: `prj-${Date.parse(nu).toString(36)}`,
    naam: o.naam ?? "RoomPlan-scan",
    aangemaakt: nu,
    gewijzigd: nu,
    verdiepingen: [{ ...v, openingen }],
  });
  return { project, meldingen };
}
