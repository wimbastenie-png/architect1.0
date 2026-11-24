import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { appartement } from "../examples/appartement.ts";
import {
  controleerSamenhang,
  lastenboek,
  lastenboekCSV,
  lastenboekTSV,
  maatketens,
  meetstaat,
  muurVorm,
  openingenLijst,
  openingLabels,
  peilTekst,
  projectNaarPDF,
  hernoemVerdieping,
  verdiepingNaarDXF,
  verdiepingNaarSVG,
  verwijderVerdieping,
  voegVerdiepingToe,
  volgendPeil,
  zetBinnenLengte,
} from "../src/index.ts";

const v0 = appartement.verdiepingen[0]!;

describe("openingenlijst", () => {
  it("geeft codes per soort en markeert binnendeuren", () => {
    const l = openingenLijst(appartement);
    expect(l.map((r) => r.code)).toEqual(["D1", "D2", "R1", "R2"]);
    const binnen = l.find((r) => r.id === "o-binnendeur")!;
    expect(binnen.buiten).toBe(false);
    expect(binnen.ruimtes).toEqual(["Leefruimte", "Slaapkamer"]);
    expect(openingLabels(appartement).get("o-binnendeur")).toBe(`${binnen.code} · 830`);
    expect(openingLabels(appartement).get("o-raam-leef")).toBe("R1");
  });

  it("codes lopen door over verdiepingen", () => {
    const { project } = voegVerdiepingToe(appartement, { modus: "kopie", naam: "Eerste verdieping" });
    const v1 = project.verdiepingen[1]!;
    const metRaam = { ...project, verdiepingen: [v0, { ...v1, openingen: [{ ...v0.openingen[0]!, id: "o-boven", muurId: v1.muren[0]!.id }] }] };
    expect(openingenLijst(metRaam).find((r) => r.id === "o-boven")!.code).toBe("R3");
  });

  it("labels staan in SVG en DXF", () => {
    expect(verdiepingNaarSVG(v0)).toContain("D2 · 830");
    expect(verdiepingNaarDXF(v0)).toContain("R1");
  });
});

describe("hulplijnen", () => {
  it("vertrekken op het gevelvlak", () => {
    const k = maatketens(v0);
    const onder = k.filter((m) => m.a.y === m.b.y && m.a.y < 0);
    // onderste gevel: buitenvlak op y = −150
    for (const m of onder) {
      expect(m.hulpA!.y).toBe(-150);
      expect(m.hulpA!.x).toBe(m.a.x);
    }
    const minY = Math.min(...v0.muren.flatMap((m) => muurVorm(m, v0.muren)).map((p) => p.y));
    expect(minY).toBe(-150);
  });
});

describe("lastenboek", () => {
  const lb = lastenboek(appartement);
  const leef = (code: string) => lb.regels.find((r) => r.ruimte === "Leefruimte" && r.code === code)?.hoeveelheid;

  it("rekent posten per ruimte", () => {
    expect(leef("01")).toBe(26.1); // vloer
    expect(leef("02")).toBe(18.84); // plinten: 20,6 − 0,93 − 0,83
    expect(leef("03")).toBe(48.3); // wand netto = meetstaat
    expect(leef("05")).toBe(10.56); // dagkanten: raam 2×1,5+2,4 + voordeur 2×2,115+0,93
    expect(leef("08")).toBe(2.4); // vensterbank
    expect(leef("09")).toBe(5.57); // 2,4×1,5 + 0,93×2,115
  });

  it("telt een binnendeur één keer", () => {
    expect(lb.totalen.find((t) => t.code === "10")!.hoeveelheid).toBe(1);
  });

  it("totalen = som van de ruimtes en stemmen met de meetstaat", () => {
    const vloer = meetstaat(appartement).reduce((s, r) => s + r.vloerM2, 0);
    expect(lb.totalen.find((t) => t.code === "01")!.hoeveelheid).toBeCloseTo(vloer, 2);
  });

  it("CSV voor Belgische Excel met formules zonder taalgebonden functies", () => {
    const csv = lastenboekCSV(lb, "Test");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("01;Vloerafwerking;m²;41,40;;=D2*E2");
    expect(csv).not.toMatch(/SUM|SOM/);
    expect(csv).toMatch(/Totaal excl\. btw;;;;=F2\+F3/);
    expect(csv).toContain("Standaardbestek 250");
  });

  it("TSV om te plakken", () => {
    expect(lastenboekTSV(lb).split("\n")[0]).toBe("01\tVloerafwerking\tm²\t41,40");
  });
});

describe("verdiepingen", () => {
  it("kopie van de indeling: zelfde muren en ruimtes, geen openingen, gemarkeerd als overgenomen", () => {
    const { project, verdiepingId } = voegVerdiepingToe(appartement, { modus: "kopie", naam: "Eerste verdieping" });
    expect(project.verdiepingen).toHaveLength(2);
    const v1 = project.verdiepingen.find((v) => v.id === verdiepingId)!;
    expect(v1.peil).toBe(volgendPeil(v0)); // 0 + 2700 + 300
    expect(v1.peil).toBe(3000);
    expect(v1.muren).toHaveLength(v0.muren.length);
    expect(v1.openingen).toHaveLength(0);
    expect(v1.muren.every((m) => m.bron.methode === "overgenomen")).toBe(true);
    expect(controleerSamenhang(project)).toEqual([]);
    expect(meetstaat(project).filter((r) => r.verdieping === "Eerste verdieping").map((r) => r.bron)).toEqual(["overgenomen", "overgenomen"]);
  });

  it("nagemeten maat op de kopie wordt 'laser'", () => {
    const { project, verdiepingId } = voegVerdiepingToe(appartement, { modus: "kopie", naam: "1" });
    const v1 = project.verdiepingen.find((v) => v.id === verdiepingId)!;
    const w = v1.muren[0]!;
    const v1b = zetBinnenLengte(v1, w.id, 5850, "start", "laser");
    expect(v1b.muren[0]!.bron.methode).toBe("laser");
  });

  it("nieuwe rechthoek, hernoemen, verwijderen, peiltekst", () => {
    let { project } = voegVerdiepingToe(appartement, { modus: "rechthoek", naam: "Zolder", binnenBreedte: 4000, binnenDiepte: 3000, plafondhoogte: 2200, muurdikte: 200 });
    expect(controleerSamenhang(project)).toEqual([]);
    const zolder = project.verdiepingen.find((v) => v.naam === "Zolder")!;
    project = hernoemVerdieping(project, zolder.id, "Zolder links");
    expect(project.verdiepingen.some((v) => v.naam === "Zolder links")).toBe(true);
    project = verwijderVerdieping(project, zolder.id);
    expect(project.verdiepingen).toHaveLength(1);
    expect(() => verwijderVerdieping(project, project.verdiepingen[0]!.id)).toThrow(/minstens één/);
    expect(peilTekst(0)).toBe("±0,00 m");
    expect(peilTekst(2900)).toBe("+2,90 m");
    expect(peilTekst(-450)).toBe("−0,45 m");
  });

  it("PDF: één planblad per verdieping + lijsten, titel met peil", async () => {
    const { project } = voegVerdiepingToe(appartement, { modus: "kopie", naam: "Eerste verdieping" });
    const doc = await PDFDocument.load(await projectNaarPDF(project, { datum: "2026-11-24" }));
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(3);
  });
});

describe("afronding", () => {
  it("plan, meetstaat en lastenboek tonen hetzelfde oppervlak (26,325 m² → 26,33)", async () => {
    const { m2, rechthoekigProject, meetstaat, lastenboek, verdiepingNaarSVG } = await import("../src/index.ts");
    expect(m2(26_325_000)).toBe(26.33);
    const p = rechthoekigProject({ naam: "x", binnenBreedte: 5850, binnenDiepte: 4500, plafondhoogte: 2600, muurdikte: 200 });
    expect(meetstaat(p)[0]!.vloerM2).toBe(26.33);
    expect(lastenboek(p).totalen[0]!.hoeveelheid).toBe(26.33);
    expect(verdiepingNaarSVG(p.verdiepingen[0]!)).toContain("26,33 m²");
  });
});
