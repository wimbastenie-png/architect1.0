import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { appartement } from "../examples/appartement.ts";
import { binnenLengte, leesProject, modelWaarde, statistiek, werftestNaarPDF, werftestRapport, type Controlemeting, type Project } from "../src/index.ts";

const v = appartement.verdiepingen[0]!;
const r = v.ruimtes[0]!;
const mu = v.muren[0]!;
const o = v.openingen[0]!;
const m = (x: Partial<Controlemeting> & Pick<Controlemeting, "soort" | "gemeten">): Controlemeting => ({ id: Math.random().toString(36), verdiepingId: v.id, instrument: "laser", datum: "2026-12-01", ...x });

describe("werftestprotocol", () => {
  it("statistiek: gemiddeld, absoluut, RMS, max, binnen tolerantie", () => {
    const s = statistiek([3, -4, 12, 0, -1], 10);
    expect(s).toEqual({ n: 5, binnen: 4, gemiddeld: 2, gemiddeldAbs: 4, max: 12, rms: 5.8, binnenPct: 80 });
    expect(statistiek([], 10).n).toBe(0);
  });

  it("modelwaarden uit het plan en verschil = plan − gemeten", () => {
    const binnen = Math.round(binnenLengte(mu, v.muren));
    const p: Project = { ...appartement, werftest: { methode: "camera", tolerantie: 10, metingen: [
      m({ soort: "muur", refId: mu.id, gemeten: binnen - 7 }),
      m({ soort: "plafond", refId: r.id, gemeten: r.plafondhoogte + 15 }),
      m({ soort: "opening-breedte", refId: o.id, gemeten: o.breedte }),
      m({ soort: "opening-hoogte", refId: o.id, gemeten: o.hoogte - 2 }),
      m({ soort: "vrij", model: 1000, gemeten: 1004, omschrijving: "nis keuken" }),
      m({ soort: "muur", refId: "bestaat-niet", gemeten: 1000 }),
    ] } };
    expect(modelWaarde(p, p.werftest!.metingen[0]!)).toBe(binnen);
    const rap = werftestRapport(p);
    expect(rap.resultaten.map((x) => x.verschil)).toEqual([7, -15, 0, 2, -4]);
    expect(rap.resultaten.map((x) => x.binnen)).toEqual([true, false, true, true, true]);
    expect(rap.totaal.binnenPct).toBe(80);
    expect(rap.weg).toHaveLength(1);
    expect(rap.perSoort.find((x) => x.soort === "muur")!.stat.n).toBe(1);
    expect(rap.opmerkingen.join(" ")).toMatch(/minstens 10/);
    expect(rap.opmerkingen.join(" ")).toMatch(/niet meer in het plan/);
    expect(leesProject(JSON.parse(JSON.stringify(p))).ok).toBe(true);
  });

  it("vaste afwijking wordt gemeld; PDF wordt gemaakt", async () => {
    const binnen = Math.round(binnenLengte(mu, v.muren));
    const metingen = Array.from({ length: 10 }, (_, i) => m({ soort: "muur", refId: mu.id, gemeten: binnen - 8 + (i % 2) }));
    const p: Project = { ...appartement, werftest: { methode: "scan", tolerantie: 10, metingen } };
    const rap = werftestRapport(p);
    expect(rap.opmerkingen.join(" ")).toMatch(/gemiddeld 7\.5 mm groter|gemiddeld 7,5 mm groter|groter dan gemeten/);
    const pdf = await werftestNaarPDF(p);
    expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThanOrEqual(1);
  });
});
