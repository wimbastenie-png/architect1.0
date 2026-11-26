import { describe, expect, it } from "vitest";
import { appartement } from "../examples/appartement.ts";
import { lastenUitModel, leesProject, lijfWeerstand, PROFIELEN, rekenKolom, rekenLigger, voegVerdiepingToe, type LiggerInvoer } from "../src/index.ts";

const basis: LiggerInvoer = { id: "l", naam: "L", dagmaat: 3800, oplegging: 200, staal: "S235", aantal: 1, kipVerhinderd: true, doorbuiging: 500, lasten: [], reeksen: ["IPE"] };
const ipe = (r: ReturnType<typeof rekenLigger>, naam = "IPE 200") => r.resultaten.find((x) => x.profiel.naam === naam)!;
const e200 = (22.4 * 9.81) / 1000;

describe("liggers en stabiliteit uitgebreid", () => {
  it("puntlast in het midden: M_Ed = 1,35·P·L/4 + eigengewicht", () => {
    const r = rekenLigger({ ...basis, puntlasten: [{ omschrijving: "balk", soort: "G", waarde: 20, a: 2000 }] });
    expect(ipe(r).controles[0]!.ed).toBeCloseTo(1.35 * 20 + 1.35 * e200 * 2, 2);
    expect(r.reacties[0]).toBeCloseTo(1.35 * 10 + 1.35 * e200 * 2, 1);
  });

  it("doorgaande ligger (2 × 4 m): steunpuntsmoment qL²/8, middenreactie 10/8·qL", () => {
    const r = rekenLigger({ ...basis, tweede: 3800, lasten: [{ omschrijving: "g", soort: "G", waarde: 10 }] });
    expect(r.spans).toEqual([4000, 4000]);
    const qd = 1.35 * (10 + e200);
    const b = ipe(r).controles[0]!;
    expect(b.ed).toBeCloseTo(qd * 2, 1); // |M_B| = qL²/8 = q·16/8
    expect(ipe(r).controles.some((c) => c.naam === "Lijf (tussensteun)")).toBe(true);
  });

  it("doorgaande ligger: variabele last op één overspanning geeft een groter veldmoment (patroonbelasting)", () => {
    const met = rekenLigger({ ...basis, tweede: 3800, lasten: [{ omschrijving: "q", soort: "Q", waarde: 10 }] });
    // veldmoment met Q op één overspanning ≈ 0,0957·qL² > 0,0703·qL² (beide belast)
    const Mveld = (0.0957 * 1.5 * 10 * 16);
    expect(ipe(met).controles[0]!.ed).toBeGreaterThan(Mveld * 0.95);
  });

  it("lijfstuik/lijfplooi: groeit met de opleglengte en is groter voor HEB dan IPE", () => {
    const p = (n: string) => PROFIELEN.find((x) => x.naam === n)!;
    const a = lijfWeerstand(p("IPE 200"), 235, 100, true).FRd, b = lijfWeerstand(p("IPE 200"), 235, 200, true).FRd;
    expect(b).toBeGreaterThan(a);
    expect(lijfWeerstand(p("HEB 200"), 235, 200, true).FRd).toBeGreaterThan(b);
    expect(b / 1000).toBeGreaterThan(50);
    expect(b / 1000).toBeLessThan(400);
    expect(lijfWeerstand(p("IPE 200"), 235, 200, false).FRd).toBeGreaterThan(b); // tussensteun: k_F = 6
  });

  it("oplegging tegen een ingegeven metselwerksterkte", () => {
    const r = rekenLigger({ ...basis, metselwerkFd: 0.5, lasten: [{ omschrijving: "g", soort: "G", waarde: 30 }] });
    const c = ipe(r, r.keuze ? r.keuze.profiel.naam : "IPE 200").controles.find((x) => x.naam === "Oplegging metselwerk")!;
    expect(c).toBeTruthy();
    expect(r.opleg.advies).toMatch(/f_d 0,5|oplegvlak/);
  });

  it("lastendaling uit het model (2 verdiepingen)", () => {
    const p = voegVerdiepingToe(appartement, { modus: "kopie", naam: "Verdieping" }).project;
    const l = lastenUitModel(p, "m-binnen");
    const t = l.map((x) => x.omschrijving).join("\n");
    expect(l.find((x) => x.omschrijving.startsWith("Muur boven de opening"))!.waarde).toBeCloseTo(0.585 * 0.1 * 19, 2);
    expect(l.find((x) => x.omschrijving.startsWith("Vloer boven Gelijkvloers"))!.waarde).toBeCloseTo(4.5 * 4.6, 2); // invloed 2,9 + 1,7 m
    expect(l.find((x) => x.omschrijving.startsWith("Muur erboven"))!.waarde).toBeCloseTo(2.7 * 0.1 * 19, 2);
    expect(l.some((x) => x.soort === "S")).toBe(true);
    expect(t).toContain("aanname: vloer draagt af op deze muur");
  });

  it("kolom HEB 160, 3 m, S235: N_b,Rd ≈ 853 kN (knik om de z-as, kromme c)", () => {
    const k = rekenKolom({ id: "k", naam: "K1", lengte: 3000, staal: "S235", gk: 100, qk: 50, reeksen: ["HEB"] });
    const heb = k.resultaten.find((x) => x.profiel.naam === "HEB 160")!;
    expect(heb.NbRd).toBeCloseTo(853, -1);
    expect(heb.uitleg).toContain("z-as");
    expect(k.NEd).toBe(1.35 * 100 + 1.5 * 50);
    expect(k.keuze!.ok).toBe(true);
    const p = { ...appartement, kolommen: [{ id: "k", naam: "K1", lengte: 3000, staal: "S235" as const, gk: 0, qk: 0 }], liggers: [{ ...basis, puntlasten: [{ omschrijving: "p", soort: "Q" as const, waarde: 5, a: 1000 }], tweede: 3000 }] };
    expect(leesProject(JSON.parse(JSON.stringify(p))).ok).toBe(true);
  });
});
