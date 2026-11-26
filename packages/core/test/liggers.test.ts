import { describe, expect, it } from "vitest";
import { appartement } from "../examples/appartement.ts";
import { berekendeGrootheden, leesProject, mcr, muurLast, nieuweLigger, PROFIELEN, rekenLigger, vloerLast, type LiggerInvoer } from "../src/index.ts";

const basis: LiggerInvoer = {
  id: "l1", naam: "Test", dagmaat: 2000, oplegging: 200, staal: "S235", aantal: 1, kipVerhinderd: true, doorbuiging: 500,
  lasten: [{ omschrijving: "muur", soort: "G", waarde: 15 }, { omschrijving: "vloer", soort: "Q", waarde: 4 }],
};

describe("profieltabel", () => {
  it("tabelwaarden kloppen met de afmetingen (A, Iy, Wel, Wpl, gewicht binnen 1 %)", () => {
    for (const p of PROFIELEN) {
      const g = berekendeGrootheden(p);
      const hw = p.h - 2 * p.tf, hoek = (4 - Math.PI) * p.r ** 2;
      const Wpl = p.b * p.tf * (p.h - p.tf) + (p.tw * hw * hw) / 4 + hoek * (hw / 2 - 0.2234 * p.r);
      expect(Math.abs(g.A / 100 / p.A - 1), p.naam).toBeLessThan(0.01);
      expect(Math.abs(g.Iy / 1e4 / p.Iy - 1), p.naam).toBeLessThan(0.01);
      expect(Math.abs(p.Iy / (p.h / 20) / p.Wel - 1), p.naam).toBeLessThan(0.01);
      expect(Math.abs(Wpl / 1000 / p.Wpl - 1), p.naam).toBeLessThan(0.01);
      expect(Math.abs((p.A * 0.785) / p.G - 1), p.naam).toBeLessThan(0.01);
    }
  });
});

describe("ligger", () => {
  it("handberekening IPE 200, S235: buiging, dwarskracht, doorbuiging", () => {
    const r = rekenLigger(basis);
    expect(r.L).toBe(2200);
    const ipe = r.resultaten.find((x) => x.profiel.naam === "IPE 200")!;
    const qd = 1.35 * (15 + (22.4 * 9.81) / 1000) + 1.5 * 4; // 26,547 kN/m
    const b = ipe.controles.find((c) => c.naam === "Buiging")!;
    expect(b.ed).toBeCloseTo((qd * 2.2 ** 2) / 8, 3); // 16,06 kNm
    expect(b.rd).toBeCloseTo(51.935, 2); // 221 cm³ × 235
    const d = ipe.controles.find((c) => c.naam === "Doorbuiging")!;
    expect(d.ed).toBeCloseTo(1.437, 2);
    expect(d.rd).toBeCloseTo(4.4, 5);
    expect(ipe.ok).toBe(true);
    // de keuze voldoet en is het lichtste profiel dat voldoet
    expect(r.keuze!.ok).toBe(true);
    expect(r.resultaten.filter((x) => x.ok).every((x) => x.profiel.G >= r.keuze!.profiel.G)).toBe(true);
    expect(r.combinatie).toBe("1,35·G + 1,5·Q");
    expect(r.reactie.ed).toBeCloseTo((r.qd * 2.2) / 2, 5);
  });

  it("sneeuw en gebruik samen: één leidende, de andere met ψ0", () => {
    const r = rekenLigger({ ...basis, lasten: [...basis.lasten, { omschrijving: "sneeuw", soort: "S", waarde: 2 }] });
    expect(r.combinatie).toBe("1,35·G + 1,5·Q + 1,5·0,5·S");
  });

  it("zonder kipsteun: kip maatgevend bij een lange overspanning", () => {
    const lang = { ...basis, dagmaat: 6000, lasten: [{ omschrijving: "g", soort: "G" as const, waarde: 12 }] };
    const met = rekenLigger(lang), zonder = rekenLigger({ ...lang, kipVerhinderd: false });
    const ipe300 = zonder.resultaten.find((x) => x.profiel.naam === "IPE 300")!;
    const kip = ipe300.controles.find((c) => c.naam === "Kip")!;
    const buig = ipe300.controles.find((c) => c.naam === "Buiging")!;
    expect(kip.rd).toBeLessThan(buig.rd * 0.7);
    expect(zonder.keuze!.profiel.G).toBeGreaterThan(met.keuze!.profiel.G);
    // Mcr klassiek (C1 = 1, last in de dwarskrachtcentrum) ligt hoger dan met de last op de bovenflens
    expect(mcr(PROFIELEN.find((p) => p.naam === "IPE 300")!, 6200)).toBeGreaterThan(0);
  });

  it("S355 HEA 300: flens klasse 3 → elastisch weerstandsmoment", () => {
    const r = rekenLigger({ ...basis, staal: "S355", reeksen: ["HEA"] });
    const hea = r.resultaten.find((x) => x.profiel.naam === "HEA 300")!;
    expect(hea.klasse).toBe(3);
    expect(hea.controles[0]!.rd).toBeCloseTo((1260 * 1000 * 355) / 1e6, 3);
  });

  it("geen profiel voldoet: duidelijke waarschuwing", () => {
    const r = rekenLigger({ ...basis, dagmaat: 9000, lasten: [{ omschrijving: "zwaar", soort: "G", waarde: 200 }] });
    expect(r.keuze).toBeNull();
    expect(r.waarschuwingen.join(" ")).toContain("Geen enkel profiel");
  });

  it("hulpjes en opslaan in het project", () => {
    expect(muurLast(2500, 300, 19)).toBeCloseTo(14.25, 5);
    expect(vloerLast(2000, 4.5)).toBe(9);
    const l = nieuweLigger("l9", 2400, 300);
    expect(l.aantal).toBe(2);
    const p = leesProject(JSON.parse(JSON.stringify({ ...appartement, liggers: [l] })));
    expect(p.ok && p.project.liggers).toHaveLength(1);
  });
});

describe("rekennota", () => {
  it("PDF met disclaimer op elk blad en aftekenvak", async () => {
    const { rekennotaNaarPDF } = await import("../src/index.ts");
    const { execFileSync } = await import("node:child_process");
    const { writeFileSync, mkdtempSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const p = { ...appartement, liggers: [basis, { ...basis, id: "l2", naam: "Ligger 2", kipVerhinderd: false, aantal: 2 }] };
    const pad = join(mkdtempSync(join(tmpdir(), "lig-")), "r.pdf");
    writeFileSync(pad, await rekennotaNaarPDF(p, p.liggers, { datum: "2026-11-26" }));
    let tekst = "";
    try { tekst = execFileSync("pdftotext", ["-layout", pad, "-"], { encoding: "utf8" }); } catch { return; }
    for (const b of tekst.split("\f").filter((x) => x.trim())) expect(b).toContain("NIET VOOR UITVOERING");
    expect(tekst).toContain("Naam ingenieur");
    expect(tekst).toContain("Kip");
    expect(tekst).toMatch(/Voorstel: IPE \d+ S235/);
  });
});
