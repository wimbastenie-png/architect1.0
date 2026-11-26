import { describe, expect, it } from "vitest";
import { appartement } from "../examples/appartement.ts";
import { opwekking, rechthoekigProject, specifiekeOpbrengst, warmteverlies, zonnepanelen, type Project } from "../src/index.ts";

function kamer(): Project {
  const p = rechthoekigProject({ naam: "Test", ruimteNaam: "Woonkamer", binnenBreedte: 4000, binnenDiepte: 3000, plafondhoogte: 2500, muurdikte: 300, methode: "laser" });
  const v = p.verdiepingen[0]!;
  return {
    ...p,
    verdiepingen: [{
      ...v,
      muren: v.muren.map((m) => ({ ...m, epb: { uIngegeven: 0.5, lagen: [], fotos: [] } })),
      epb: { vloer: { grens: "grond", uIngegeven: 0.4, lagen: [], fotos: [] }, plafond: { grens: "buiten", uIngegeven: 0.2, lagen: [], fotos: [] } },
    }],
  };
}

describe("warmteverlies (vereenvoudigd EN 12831)", () => {
  it("één kamer: transmissie en ventilatie volgens de handberekening", () => {
    const [r] = warmteverlies(kamer());
    // H_T = 35 m² × 0,6 + 12 × 0,5 × 0,3 + 12 × 0,3 × 1 = 21 + 1,8 + 3,6 = 26,4 W/K; ΔT = 20 − (−7) = 27
    expect(r!.transmissie).toBe(Math.round(26.4 * 27));
    // V̇ = max(0,5 × 30; 0,2 × 30 + 75 m³/h toevoer woonkamer) = 81 m³/h
    expect(r!.ventilatie).toBe(Math.round(0.34 * 81 * 27));
    expect(r!.aannames).toBe(0);
    // radiator bij 45/35: LMTD 19,58 K → factor (19,58/50)^1,3
    const lmtd = 10 / Math.log(25 / 15);
    expect(r!.radiatorNominaal).toBeCloseTo((r!.totaal * 1.15) / (lmtd / 50) ** 1.3, -1);
  });

  it("onbekende U-waarden: aanname, gemarkeerd; systeem D verlaagt het ventilatieverlies", () => {
    const zonder = warmteverlies(appartement);
    expect(zonder.every((r) => r.aannames > 0)).toBe(true);
    const D = warmteverlies({ ...appartement, ventilatie: { systeem: "D" } });
    expect(D[0]!.ventilatie).toBeLessThan(zonder[0]!.ventilatie);
    const o = opwekking(appartement);
    expect(o.warmtepomp).toBeGreaterThan(0);
    expect(o.buffervat).toBe(Math.round(o.warmtepomp * 15));
  });

  it("vloerverwarming met veel verlies: opmerking", () => {
    const p = { ...appartement, verwarming: { buitentemperatuur: -10, afgifte: { [appartement.verdiepingen[0]!.ruimtes[1]!.id]: "vloer" as const }, regime: "45/35" as const, zonnepanelen: true } };
    const r = warmteverlies(p).find((x) => x.afgifte === "vloer")!;
    expect(r.opmerking ?? "").toMatch(/W\/m²|^$/);
  });
});

describe("zonnepanelen", () => {
  it("zadeldak 35°, nok evenwijdig met de voorgevel: zuidvlak en noordvlak", () => {
    const z = zonnepanelen({ ...appartement, dak: { soort: "zadel", helling: 35, nok: "x", overstek: 300, dikte: 300 } });
    expect(z).toHaveLength(2);
    const zuid = z.find((x) => x.richting === "Z")!, noord = z.find((x) => x.richting === "N")!;
    expect(zuid.panelen).toBe(8); // 8 kolommen × 1 rij (dakvlak ± 3,48 m lang)
    expect(zuid.opbrengst).toBe(Math.round(zuid.kWp * 930));
    expect(noord.opbrengst).toBeLessThan(zuid.opbrengst * 0.7);
    expect(specifiekeOpbrengst(90, 35)).toBeLessThan(specifiekeOpbrengst(180, 35));
  });
});
