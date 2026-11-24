import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { appartement } from "../examples/appartement.ts";
import { kiesBlad, projectNaarPDF, tekenGrenzen } from "../src/index.ts";

const v0 = appartement.verdiepingen[0]!;
const PT = 72 / 25.4;

describe("pdf", () => {
  it("kiest A4 op 1:50 voor een klein appartement", () => {
    expect(kiesBlad(v0)).toEqual({ papier: "A4", schaal: 50, past: true });
  });

  it("schakelt over naar grotere schaal als het niet past", () => {
    const groot = { ...v0, muren: v0.muren.map((m) => ({ ...m, start: { x: m.start.x * 3, y: m.start.y * 3 }, eind: { x: m.eind.x * 3, y: m.eind.y * 3 } })) };
    const g = tekenGrenzen(groot);
    expect(g.maxX - g.minX).toBeGreaterThan(28000);
    const k = kiesBlad(groot);
    expect(k.past).toBe(true);
    expect(k.schaal).toBeGreaterThanOrEqual(100);
  });

  it("respecteert een opgelegde schaal en meldt als het niet past", () => {
    expect(kiesBlad(v0, { papier: "A4", schaal: 100 })).toEqual({ papier: "A4", schaal: 100, past: true });
    const groot = { ...v0, muren: v0.muren.map((m) => ({ ...m, start: { x: m.start.x * 10, y: m.start.y * 10 }, eind: { x: m.eind.x * 10, y: m.eind.y * 10 } })) };
    expect(kiesBlad(groot, { schaal: 50 }).past).toBe(false);
  });

  it("maakt een geldige PDF met één blad per verdieping op A4 liggend", async () => {
    const twee = { ...appartement, verdiepingen: [v0, { ...v0, id: "v1", naam: "Eerste verdieping" }] };
    const bytes = await projectNaarPDF(twee, { datum: "2026-11-24" });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    const { width, height } = doc.getPage(0).getSize();
    expect(width / PT).toBeCloseTo(297, 0);
    expect(height / PT).toBeCloseTo(210, 0);
    expect(doc.getTitle()).toContain(appartement.naam);
  });
});
