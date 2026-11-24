/**
 * Voorbeeld: appartement met leefruimte en slaapkamer.
 * Buitenmuren 300 mm (hartlijn op 0..9600 × 0..4800), binnenmuur 100 mm op x = 6000.
 * Binnenmaten: leefruimte 5800 × 4500, slaapkamer 3400 × 4500.
 */
import { Project, type ProjectInvoer } from "../src/schema.ts";

const scan = { methode: "gescand" as const, nauwkeurigheidMm: 30, toestel: "iPhone 15 Pro (RoomPlan)" };
const H = 2700;

export const appartementInvoer: ProjectInvoer = {
  schemaVersie: "0.1",
  id: "prj-voorbeeld",
  naam: "Appartement Voorbeeldstraat 12",
  adres: { straat: "Voorbeeldstraat 12", postcode: "9000", gemeente: "Gent", gewest: "vlaanderen" },
  bouwjaar: 1972,
  aangemaakt: "2026-11-24T10:00:00Z",
  gewijzigd: "2026-11-24T10:00:00Z",
  verdiepingen: [
    {
      id: "v0",
      naam: "Gelijkvloers",
      muren: [
        { id: "m-onder-links", start: { x: 0, y: 0 }, eind: { x: 6000, y: 0 }, dikte: 300, hoogte: H, dragend: "vermoeden", bron: scan },
        { id: "m-onder-rechts", start: { x: 6000, y: 0 }, eind: { x: 9600, y: 0 }, dikte: 300, hoogte: H, dragend: "vermoeden", bron: scan },
        { id: "m-rechts", start: { x: 9600, y: 0 }, eind: { x: 9600, y: 4800 }, dikte: 300, hoogte: H, dragend: "vermoeden", bron: scan },
        { id: "m-boven-rechts", start: { x: 9600, y: 4800 }, eind: { x: 6000, y: 4800 }, dikte: 300, hoogte: H, dragend: "vermoeden", bron: scan },
        { id: "m-boven-links", start: { x: 6000, y: 4800 }, eind: { x: 0, y: 4800 }, dikte: 300, hoogte: H, dragend: "vermoeden", bron: scan },
        { id: "m-links", start: { x: 0, y: 4800 }, eind: { x: 0, y: 0 }, dikte: 300, hoogte: H, dragend: "vermoeden", bron: scan },
        { id: "m-binnen", start: { x: 6000, y: 0 }, eind: { x: 6000, y: 4800 }, dikte: 100, hoogte: H, dragend: "onbekend", bron: scan },
      ],
      openingen: [
        { id: "o-raam-leef", muurId: "m-onder-links", soort: "raam", offset: 1500, breedte: 2400, hoogte: 1500, borstwering: 900, bron: scan },
        { id: "o-raam-slaap", muurId: "m-onder-rechts", soort: "raam", offset: 900, breedte: 1600, hoogte: 1400, borstwering: 1000, bron: scan },
        { id: "o-voordeur", muurId: "m-links", soort: "deur", offset: 1000, breedte: 930, hoogte: 2115, bron: scan },
        { id: "o-binnendeur", muurId: "m-binnen", soort: "deur", offset: 3200, breedte: 830, hoogte: 2115, bron: scan },
      ],
      ruimtes: [
        {
          id: "r-leef",
          naam: "Leefruimte",
          contour: [{ x: 150, y: 150 }, { x: 5950, y: 150 }, { x: 5950, y: 4650 }, { x: 150, y: 4650 }],
          plafondhoogte: H,
          muurIds: ["m-onder-links", "m-boven-links", "m-links", "m-binnen"],
          bron: scan,
        },
        {
          id: "r-slaap",
          naam: "Slaapkamer",
          contour: [{ x: 6050, y: 150 }, { x: 9450, y: 150 }, { x: 9450, y: 4650 }, { x: 6050, y: 4650 }],
          plafondhoogte: H,
          muurIds: ["m-onder-rechts", "m-rechts", "m-boven-rechts", "m-binnen"],
          bron: scan,
        },
      ],
    },
  ],
};

export const appartement = Project.parse(appartementInvoer);
