import { describe, expect, it } from "vitest";
import { appartement } from "../examples/appartement.ts";
import { maatketens, muurVorm, rechthoekigProject, voegRuimteToe } from "../src/index.ts";

const v0 = appartement.verdiepingen[0]!;
const rij = (z: (m: { a: { x: number; y: number }; b: { x: number; y: number } }) => boolean, r: number) =>
  maatketens(v0).filter((m) => m.rij === r && z(m)).sort((p, q) => p.a.x - q.a.x || p.a.y - q.a.y).map((m) => Math.round(m.lengte));
const onder = (m: { a: { y: number }; b: { y: number } }) => m.a.y === m.b.y && m.a.y < 0;
const links = (m: { a: { x: number }; b: { x: number } }) => m.a.x === m.b.x && m.a.x < 0;

describe("maatketens", () => {
  it("onderzijde: openingen, gevelstukken en totaal", () => {
    expect(rij(onder, 0)).toEqual([1650, 2400, 2100, 900, 1600, 1250]);
    expect(rij(onder, 1)).toEqual([6150, 3750]);
    expect(rij(onder, 2)).toEqual([9900]);
  });

  it("linkerzijde: voordeur in de ketting, geen totaal bij één gevelstuk", () => {
    expect(rij(links, 0)).toEqual([3020, 930, 1150]);
    expect(rij(links, 1)).toEqual([5100]);
    expect(rij(links, 2)).toEqual([]);
  });

  it("rijen liggen buiten het hele gebouw en tellen op", () => {
    const minY = Math.min(...v0.muren.flatMap((m) => muurVorm(m, v0.muren)).map((p) => p.y));
    for (const m of maatketens(v0).filter(onder)) expect(m.a.y).toBeLessThan(minY);
    const som = (r: number) => rij(onder, r).reduce((s, x) => s + x, 0);
    expect(som(0)).toBe(9900);
    expect(som(1)).toBe(9900);
  });

  it("aanbouw: gevelmaten komen voorbij de aanbouw, zonder kruising", () => {
    const v = voegRuimteToe(v0, { muurId: "m-rechts", naam: "Berging", breedte: 2000, diepte: 1500, afstandVanafA: 1000, muurdikte: 200, plafondhoogte: 2400 });
    const maxX = Math.max(...v.muren.flatMap((m) => muurVorm(m, v.muren)).map((p) => p.x));
    const rechts = maatketens(v).filter((m) => m.a.x === m.b.x && m.a.x > 9600);
    expect(rechts.length).toBeGreaterThan(0);
    for (const m of rechts) expect(m.a.x).toBeGreaterThan(maxX);
    // berging binnen y 1150..3150, muren 200 → buitenvlakken y 950..3350.
    // gevel rechts: 1100 (−150..950) + 2400 (berging) + 1600 (3350..4950) = 5100
    expect(rechts.filter((m) => m.rij === 1).map((m) => Math.round(m.lengte)).sort()).toEqual([1100, 1600, 2400]);
    expect(rechts.filter((m) => m.rij === 2).map((m) => Math.round(m.lengte))).toEqual([5100]);
  });

  it("rechthoek zonder openingen: één rij per zijde", () => {
    const p = rechthoekigProject({ naam: "x", binnenBreedte: 2500, binnenDiepte: 1800, plafondhoogte: 2500, muurdikte: 140 });
    const k = maatketens(p.verdiepingen[0]!);
    expect(k).toHaveLength(4);
    expect(k.every((m) => m.rij === 1)).toBe(true);
  });
});
