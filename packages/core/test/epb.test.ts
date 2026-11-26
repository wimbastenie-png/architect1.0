import { describe, expect, it } from "vitest";
import { appartement } from "../examples/appartement.ts";
import { epbCSV, epbInventaris, epbNaarPDF, kompas, leesProject, uRaam, uUitLagen, verdiepingNaarSVG, type Project } from "../src/index.ts";

const spouwmuur = {
  grens: "buiten" as const,
  lagen: [
    { materiaal: "Gipspleister", dikte: 20, lambda: 0.52 },
    { materiaal: "Metselwerk volle baksteen", dikte: 190, lambda: 0.9 },
    { materiaal: "Minerale wol (glas/rots)", dikte: 60, lambda: 0.035 },
    { materiaal: "Luchtlaag (niet geventileerd, ≥ 2 cm)", dikte: 30, r: 0.17 },
    { materiaal: "Gevelsteen (buitenblad)", dikte: 90, lambda: 0.9 },
  ],
  bron: "vaststelling bij boring",
  fotos: [],
};

describe("EPB-inventaris", () => {
  it("U-waarde uit lagen (handberekening)", () => {
    // R = 0,13 + 0,02/0,52 + 0,19/0,9 + 0,06/0,035 + 0,17 + 0,09/0,9 + 0,04 = 2,4039
    expect(uUitLagen(spouwmuur, "muur")).toBeCloseTo(1 / 2.40386, 3);
    // naar onverwarmd: Rse = Rsi
    expect(uUitLagen({ ...spouwmuur, grens: "onverwarmd" }, "muur")).toBeCloseTo(1 / (2.40386 + 0.09), 3);
    expect(uUitLagen({ lagen: [], fotos: [] }, "muur")).toBeNull();
    expect(uRaam({ id: "r", muurId: "m", soort: "raam", offset: 0, breedte: 1000, hoogte: 1000, borstwering: 0, bron: { methode: "manueel" }, epb: { ug: 1.1, uf: 1.8, fotos: [] } })).toBe(1.31);
  });

  it("kompas: noordpijl draait mee", () => {
    expect(kompas({ x: 0, y: 1 }, 0).richting).toBe("N");
    expect(kompas({ x: 1, y: 0 }, 0).richting).toBe("O");
    expect(kompas({ x: 0, y: -1 }, 0).richting).toBe("Z");
    expect(kompas({ x: 0, y: -1 }, 90).richting).toBe("O"); // noorden wijst naar rechts op het plan
    expect(kompas({ x: -1, y: 1 }, 0).richting).toBe("NW");
  });

  it("appartement: oppervlaktes per richting, volume, wat ontbreekt", () => {
    const inv = epbInventaris(appartement);
    expect(inv.volume).toBe(111.78); // = meetstaat (26,10 + 15,30) × 2,7
    const z = inv.perRichting.find((x) => x.richting === "Z")!;
    expect(z.ramen).toBe(5.84); // 2,4 × 1,5 + 1,6 × 1,4
    expect(inv.perRichting.find((x) => x.richting === "W")!.deuren).toBeCloseTo(0.93 * 2.115, 2);
    expect(inv.regels.some((r) => r.soort === "vloer" && r.grens === "grond")).toBe(true);
    expect(inv.regels.some((r) => r.soort === "dak" && r.grens === "buiten")).toBe(true);
    expect(inv.ontbrekend.length).toBeGreaterThan(5);
    // noorden naar rechts: de voorgevel kijkt dan naar het oosten
    expect(epbInventaris({ ...appartement, noord: 90 }).perRichting.find((x) => x.richting === "O")!.ramen).toBe(5.84);
  });

  it("ingevulde samenstelling: berekend of ingegeven, met bron; tussenmuur telt niet", () => {
    const v = appartement.verdiepingen[0]!;
    const p: Project = { ...appartement, verdiepingen: [{ ...v, muren: v.muren.map((m) => (m.id === "m-links" ? { ...m, epb: spouwmuur } : m.id === "m-rechts" ? { ...m, epb: { uIngegeven: 0.24, bron: "EPB-verslag 2015", lagen: [], fotos: ["f1"] } } : m)) }] };
    expect(leesProject(JSON.parse(JSON.stringify(p))).ok).toBe(true);
    const inv = epbInventaris(p);
    const links = inv.regels.find((r) => r.element === "Muur m-links")!;
    expect(links.herkomst).toBe("berekend");
    expect(links.isolatie).toContain("Minerale wol (glas/rots) 60 mm");
    const rechts = inv.regels.find((r) => r.element === "Muur m-rechts")!;
    expect([rechts.u, rechts.herkomst, rechts.fotos]).toEqual([0.24, "ingegeven", 1]);
    expect(inv.regels.some((r) => r.element === "Muur m-binnen")).toBe(false);
    const csv = epbCSV(p, inv);
    expect(csv).toContain("muur;Gelijkvloers;Muur m-rechts;buiten;O;");
    expect(csv).toContain("Geen EPC-score");
  });

  it("niet-beschermde ruimte telt niet mee; noordpijl in het plan", () => {
    const v = appartement.verdiepingen[0]!;
    const p = { ...appartement, verdiepingen: [{ ...v, ruimtes: v.ruimtes.map((r) => (r.naam === "Slaapkamer" ? { ...r, beschermd: false } : r)) }] };
    expect(epbInventaris(p).volume).toBeCloseTo(26.1 * 2.7, 1);
    expect(verdiepingNaarSVG(v, { noord: 30 })).toContain('data-noordpijl="30"');
  });

  it("PDF: plan met noordpijl, invoerlijst, geen EPC-score", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(await epbNaarPDF(appartement, { datum: "2026-11-27" }));
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
