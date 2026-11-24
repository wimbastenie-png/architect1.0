/**
 * Openingenlijst: elke opening krijgt een code (R = raam, D = deur,
 * O = doorgang), genummerd over het hele project, verdieping per verdieping,
 * zoals in een raam- en deurlijst van een architect.
 */
import { muurLengte, puntLangsMuur } from "./geometrie.ts";
import type { Opening, Project, Punt, Verdieping } from "./schema.ts";

const LETTER: Record<Opening["soort"], string> = { raam: "R", deur: "D", doorgang: "O" };

export interface OpeningRij {
  code: string;
  id: string;
  soort: Opening["soort"];
  verdieping: string;
  /** Ruimtes aan weerszijden (1 = buitenmuur, 2 = binnenmuur). */
  ruimtes: string[];
  buiten: boolean;
  breedte: number;
  hoogte: number;
  borstwering: number;
  muurdikte: number;
}

/** Codes per opening-id, stabiel gesorteerd per verdieping, soort en positie. */
export function openingCodes(p: Pick<Project, "verdiepingen">): Map<string, string> {
  const codes = new Map<string, string>();
  const teller: Record<string, number> = {};
  for (const v of p.verdiepingen) {
    for (const o of gesorteerd(v)) {
      const l = LETTER[o.soort];
      teller[l] = (teller[l] ?? 0) + 1;
      codes.set(o.id, `${l}${teller[l]}`);
    }
  }
  return codes;
}

export function openingenLijst(p: Pick<Project, "verdiepingen">): OpeningRij[] {
  const codes = openingCodes(p);
  const rijen: OpeningRij[] = [];
  for (const v of p.verdiepingen) {
    const muren = new Map(v.muren.map((m) => [m.id, m]));
    for (const o of gesorteerd(v)) {
      const m = muren.get(o.muurId);
      const ruimtes = v.ruimtes.filter((r) => r.muurIds.includes(o.muurId)).map((r) => r.naam);
      rijen.push({
        code: codes.get(o.id)!, id: o.id, soort: o.soort, verdieping: v.naam, ruimtes,
        buiten: ruimtes.length < 2, breedte: o.breedte, hoogte: o.hoogte, borstwering: o.borstwering,
        muurdikte: m?.dikte ?? 0,
      });
    }
  }
  return rijen;
}

/** Plaats voor het label van een opening: midden van de opening, naast de muur aan de binnenkant. */
export function openingLabelPunt(v: Verdieping, o: Opening, afstand: number): { punt: Punt; hoek: number } | null {
  const m = v.muren.find((x) => x.id === o.muurId);
  if (!m) return null;
  const L = muurLengte(m);
  const mid = puntLangsMuur(m, o.offset + o.breedte / 2);
  let n = { x: -(m.eind.y - m.start.y) / L, y: (m.eind.x - m.start.x) / L };
  // aan de kant van een ruimte die de muur begrenst (bij een buitenmuur: binnen)
  const r = v.ruimtes.find((x) => x.muurIds.includes(m.id));
  if (r) {
    const c = r.contour.reduce((s, q) => ({ x: s.x + q.x / r.contour.length, y: s.y + q.y / r.contour.length }), { x: 0, y: 0 });
    if ((c.x - mid.x) * n.x + (c.y - mid.y) * n.y < 0) n = { x: -n.x, y: -n.y };
  }
  const d = m.dikte / 2 + afstand;
  let hoek = (Math.atan2(m.eind.y - m.start.y, m.eind.x - m.start.x) * 180) / Math.PI;
  if (hoek > 90 || hoek <= -90) hoek += 180;
  return { punt: { x: mid.x + n.x * d, y: mid.y + n.y * d }, hoek };
}

/** Labeltekst per opening-id voor het plan. */
export function openingLabels(p: Pick<Project, "verdiepingen">): Map<string, string> {
  return new Map(openingenLijst(p).map((r) => [r.id, openingLabel(r.code, r)]));
}

/** Label op het plan: code, en bij binnenmuren ook de breedte (staat niet in de gevelketting). */
export function openingLabel(code: string, rij: { buiten: boolean; breedte: number }): string {
  return rij.buiten ? code : `${code} · ${rij.breedte}`;
}

function gesorteerd(v: Verdieping): Opening[] {
  const volgorde = new Map(v.muren.map((m, i) => [m.id, i]));
  return [...v.openingen].sort(
    (a, b) => a.soort.localeCompare(b.soort) || (volgorde.get(a.muurId) ?? 0) - (volgorde.get(b.muurId) ?? 0) || a.offset - b.offset,
  );
}
