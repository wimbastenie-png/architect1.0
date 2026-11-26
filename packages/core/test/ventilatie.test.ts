import { describe, expect, it } from "vitest";
import { appartement } from "../examples/appartement.ts";
import {
  debietVan, diameter, extraPosten, functieVan, leesProject, ventilatieAandachtspunten, ventilatieDebieten, ventilatieKanalen, ventilatieMateriaal,
  verdiepingNaarSVG, voegInstallatiepuntToe, type Project, type Verdieping,
} from "../src/index.ts";

function metVentilatie(systeem: "A" | "B" | "C" | "D"): Project {
  let v: Verdieping = { ...appartement.verdiepingen[0]!, ruimtes: appartement.verdiepingen[0]!.ruimtes.map((r) => (r.naam === "Slaapkamer" ? { ...r, naam: "Badkamer" } : r)) };
  const zet = (soort: string, x: number, y: number) => { v = voegInstallatiepuntToe(v, soort, { x, y }).verdieping; };
  zet("vent-unit", 9000, 4300);
  zet("vent-toevoer", 3000, 2400);
  zet("vent-afvoer", 7700, 2400);
  return { ...appartement, verdiepingen: [v], ventilatie: { systeem } };
}

describe("ventilatie", () => {
  it("debieten volgens de richtwaarden (3,6 m³/h·m², min/max)", () => {
    expect(debietVan("woonkamer", 26.1)).toEqual({ toevoer: 94, afvoer: 0 });
    expect(debietVan("woonkamer", 15)).toEqual({ toevoer: 75, afvoer: 0 }); // minimum
    expect(debietVan("woonkamer", 60)).toEqual({ toevoer: 150, afvoer: 0 }); // begrensd
    expect(debietVan("slaapkamer", 5)).toEqual({ toevoer: 25, afvoer: 0 });
    expect(debietVan("slaapkamer", 30)).toEqual({ toevoer: 72, afvoer: 0 });
    expect(debietVan("badkamer", 6)).toEqual({ toevoer: 0, afvoer: 50 });
    expect(debietVan("wc", 1.5)).toEqual({ toevoer: 0, afvoer: 25 });
    expect(debietVan("open-keuken", 12)).toEqual({ toevoer: 0, afvoer: 75 });
    expect(functieVan({ ...appartement.verdiepingen[0]!.ruimtes[0]! })).toBe("woonkamer"); // "Leefruimte"
  });

  it("diameter bij max. 2,5 m/s (aftakking) of 3 m/s (hoofdkanaal)", () => {
    expect(diameter(25)).toBe(80);
    expect(diameter(55)).toBe(100);
    expect(diameter(150, 3)).toBe(160);
  });

  it("systeem D: kanalen van de unit naar elk ventiel, materiaal, geen dubbel tellen", () => {
    const p = metVentilatie("D");
    expect(leesProject(JSON.parse(JSON.stringify(p))).ok).toBe(true);
    const deb = ventilatieDebieten(p);
    expect(deb.find((d) => d.ruimte.naam === "Leefruimte")!.toevoer).toBe(94);
    expect(deb.find((d) => d.ruimte.naam === "Badkamer")!.afvoer).toBe(55);
    const k = ventilatieKanalen(p);
    expect(k.map((x) => [x.soort, x.debiet, x.diameter])).toEqual([["toevoer", 94, 125], ["afvoer", 55, 100]]);
    for (const x of k) for (let i = 1; i < x.pad.length; i++) expect(x.pad[i]!.x === x.pad[i - 1]!.x || x.pad[i]!.y === x.pad[i - 1]!.y).toBe(true);
    const m = ventilatieMateriaal(p);
    expect(m.find((x) => x.omschrijving.startsWith("Kanaal Ø 125"))).toBeTruthy();
    expect(m.find((x) => x.omschrijving === "Geluiddemper")!.hoeveelheid).toBe(2);
    const lb = extraPosten(p).filter((x) => x.groep === "Ventilatie");
    expect(lb.length).toBe(m.length);
    expect(extraPosten(p).some((x) => x.groep === "Elektriciteit")).toBe(false); // ventielen niet als elektriciteit
    expect(verdiepingNaarSVG(p.verdiepingen[0]!, { installaties: { project: p, netten: ["ventilatie"] } })).toContain("Ø125");
  });

  it("systeem C: toevoer via roosters — aandachtspunten tonen wat ontbreekt", () => {
    const p = metVentilatie("C");
    const a = ventilatieAandachtspunten(p).map((x) => x.tekst).join("\n");
    expect(a).toContain("Leefruimte (Gelijkvloers): toevoer van 94 m³/h nodig — plaats een toevoerrooster");
    expect(a).toContain("doorstroomopening ± 263 cm²"); // 94/25 × 70
    expect(ventilatieKanalen(p).every((x) => x.soort === "afvoer")).toBe(true);
    expect(a.toLowerCase()).not.toMatch(/\bconform\b/);
  });

  it("PDF met ventilatieblad en debietentabel", async () => {
    const { installatiesNaarPDF } = await import("../src/index.ts");
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(await installatiesNaarPDF(metVentilatie("D"), { datum: "2026-11-27" }));
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
