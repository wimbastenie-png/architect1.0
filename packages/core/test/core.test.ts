import { describe, expect, it } from "vitest";
import { appartement, appartementInvoer } from "../examples/appartement.ts";
import {
  leesProject,
  meetstaat,
  meetstaatCSV,
  muurLengte,
  omtrek,
  oppervlakte,
  verdiepingNaarDXF,
  verdiepingNaarSVG,
  zetMuurLengte,
} from "../src/index.ts";

const v0 = appartement.verdiepingen[0]!;
const muur = (v: typeof v0, id: string) => v.muren.find((m) => m.id === id)!;
const ruimte = (v: typeof v0, id: string) => v.ruimtes.find((r) => r.id === id)!;

describe("geometrie", () => {
  it("rekent oppervlakte en omtrek in mm", () => {
    const c = ruimte(v0, "r-leef").contour;
    expect(oppervlakte(c)).toBe(5800 * 4500);
    expect(omtrek(c)).toBe(2 * (5800 + 4500));
  });

  it("oppervlakte hangt niet af van draairichting", () => {
    const c = ruimte(v0, "r-leef").contour;
    expect(oppervlakte([...c].reverse())).toBe(oppervlakte(c));
  });
});

describe("validatie", () => {
  it("aanvaardt het voorbeeldproject", () => {
    expect(leesProject(appartementInvoer).ok).toBe(true);
  });

  it("weigert een opening die buiten de muur valt", () => {
    const kapot = structuredClone(appartementInvoer);
    kapot.verdiepingen[0]!.openingen![0]!.offset = 5000; // 5000 + 2400 > 6000
    const r = leesProject(kapot);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fouten[0]!.melding).toMatch(/buiten muur/);
  });

  it("weigert niet-gehele millimeters en dubbele id's", () => {
    const a = structuredClone(appartementInvoer);
    a.verdiepingen[0]!.muren![0]!.dikte = 300.5;
    expect(leesProject(a).ok).toBe(false);
    const b = structuredClone(appartementInvoer);
    b.verdiepingen[0]!.muren![1]!.id = "m-onder-links";
    const r = leesProject(b);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fouten.some((f) => /meermaals/.test(f.melding))).toBe(true);
  });
});

describe("maat aanpassen", () => {
  it("verlengt de slaapkamer met 100 mm en houdt het plan rechthoekig", () => {
    const v = zetMuurLengte(v0, "m-onder-rechts", 3700, "start", "laser");
    expect(muurLengte(muur(v, "m-onder-rechts"))).toBe(3700);
    // rechtermuur schuift in zijn geheel mee
    expect(muur(v, "m-rechts").start).toEqual({ x: 9700, y: 0 });
    expect(muur(v, "m-rechts").eind).toEqual({ x: 9700, y: 4800 });
    // bovenmuur rekt mee
    expect(muurLengte(muur(v, "m-boven-rechts"))).toBe(3700);
    // slaapkamer: 3500 × 4500, leefruimte ongewijzigd
    expect(oppervlakte(ruimte(v, "r-slaap").contour)).toBe(3500 * 4500);
    expect(oppervlakte(ruimte(v, "r-leef").contour)).toBe(5800 * 4500);
    expect(muur(v, "m-onder-rechts").bron.methode).toBe("laser");
    // origineel onveranderd
    expect(muurLengte(muur(v0, "m-onder-rechts"))).toBe(3600);
  });

  it("verschuift de binnenmuur als de leefruimte langer wordt", () => {
    const v = zetMuurLengte(v0, "m-onder-links", 6200);
    expect(muur(v, "m-binnen").start).toEqual({ x: 6200, y: 0 });
    expect(muur(v, "m-binnen").eind).toEqual({ x: 6200, y: 4800 });
    expect(muurLengte(muur(v, "m-onder-rechts"))).toBe(3400);
    expect(oppervlakte(ruimte(v, "r-leef").contour)).toBe(6000 * 4500);
    expect(oppervlakte(ruimte(v, "r-slaap").contour)).toBe(3200 * 4500);
    expect(leesProject({ ...appartement, verdiepingen: [v] }).ok).toBe(true);
  });
});

describe("meetstaat", () => {
  const rijen = meetstaat(appartement);

  it("geeft vloer, volume en wandoppervlak per ruimte", () => {
    const leef = rijen.find((r) => r.ruimte === "Leefruimte")!;
    expect(leef.vloerM2).toBe(26.1);
    expect(leef.volumeM3).toBe(70.47);
    // wand: 20,6 m × 2,7 m = 55,62 m² min raam 3,6 min voordeur 1,96695 min binnendeur 1,75545
    expect(leef.wandBrutoM2).toBe(55.62);
    expect(leef.wandNettoM2).toBe(48.3);
    expect(leef.bron).toBe("gescand");
  });

  it("schrijft CSV voor Belgische Excel", () => {
    const csv = meetstaatCSV(rijen);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Gelijkvloers;Leefruimte;26,10;");
    expect(csv).toContain("Totaal;;41,40;");
  });
});

describe("export", () => {
  it("DXF heeft lagen, entiteiten en sluit af met EOF", () => {
    const dxf = verdiepingNaarDXF(v0);
    for (const laag of ["MUREN", "OPENINGEN", "RUIMTES", "MATEN", "TEKST"]) expect(dxf).toContain(`\r\n${laag}\r\n`);
    expect(dxf.match(/\r\nPOLYLINE\r\n/g)!.length).toBe(7 + 4 + 2);
    expect(dxf.trimEnd().endsWith("EOF")).toBe(true);
    expect(dxf).toContain("\r\n6150\r\n"); // buitenmaat m-onder-links: 150 + 6000
    expect(dxf).toContain("5800 x 4500");
  });

  it("SVG bevat ruimtenamen en oppervlaktes", () => {
    const svg = verdiepingNaarSVG(v0);
    expect(svg).toContain("Leefruimte");
    expect(svg).toContain("26,10 m²");
  });
});
