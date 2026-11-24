/** Projecten starten zonder scan: uit binnenmaten gemeten met rolmeter of laser. */
import { Project, SCHEMA_VERSIE, type Bron } from "./schema.ts";

export interface RechthoekInvoer {
  naam: string;
  ruimteNaam?: string;
  /** Binnenmaten in mm (afgewerkte muur tot afgewerkte muur). */
  binnenBreedte: number;
  binnenDiepte: number;
  plafondhoogte: number;
  muurdikte: number;
  methode?: "manueel" | "laser";
  nu?: string;
}

/**
 * Eén rechthoekige ruimte met vier muren. Hartlijnen liggen een halve
 * muurdikte buiten de binnenmaten; de binnenhoek ligt op (0,0).
 */
export function rechthoekigProject(i: RechthoekInvoer): Project {
  const nu = i.nu ?? new Date().toISOString();
  const d = Math.round(i.muurdikte), h = Math.round(i.muurdikte / 2);
  const B = Math.round(i.binnenBreedte), D = Math.round(i.binnenDiepte), H = Math.round(i.plafondhoogte);
  const bron: Bron = { methode: i.methode ?? "manueel", nauwkeurigheidMm: i.methode === "laser" ? 2 : 5, tijdstip: nu };
  const p = (x: number, y: number) => ({ x, y });
  const hoeken = [p(-h, -h), p(B + h, -h), p(B + h, D + h), p(-h, D + h)];
  const namen = ["onder", "rechts", "boven", "links"];
  const muren = hoeken.map((s, k) => ({
    id: `m-${namen[k]}`,
    start: s,
    eind: hoeken[(k + 1) % 4]!,
    dikte: d,
    hoogte: H,
    dragend: "onbekend" as const,
    bron,
  }));
  return Project.parse({
    schemaVersie: SCHEMA_VERSIE,
    id: `prj-${Date.parse(nu).toString(36)}`,
    naam: i.naam,
    aangemaakt: nu,
    gewijzigd: nu,
    verdiepingen: [
      {
        id: "v0",
        naam: "Gelijkvloers",
        muren,
        openingen: [],
        ruimtes: [
          {
            id: "r-1",
            naam: i.ruimteNaam ?? "Ruimte 1",
            contour: [p(0, 0), p(B, 0), p(B, D), p(0, D)],
            plafondhoogte: H,
            muurIds: muren.map((m) => m.id),
            bron,
          },
        ],
      },
    ],
  });
}
