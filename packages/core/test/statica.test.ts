import { describe, expect, it } from "vitest";
import { los } from "../src/index.ts";

const E = 210000, I = 1943e4, EI = E * I; // IPE 200

describe("statica (handformules)", () => {
  it("vrij opgelegd, gelijkmatige last: M = qL²/8, R = qL/2, δ = 5qL⁴/384EI", () => {
    const k = los([4000], { q: [10], punten: [] }, EI);
    expect(k.Mmax).toBeCloseTo(20, 3);
    expect(k.R[0]).toBeCloseTo(20, 3);
    expect(k.R[1]).toBeCloseTo(20, 3);
    expect(k.Vmax).toBeCloseTo(20, 2);
    expect(k.delta[0]).toBeCloseTo((5 * 10 * 4000 ** 4) / (384 * EI), 2);
  });

  it("vrij opgelegd, puntlast in het midden: M = PL/4, δ = PL³/48EI; buiten het midden: R = P·b/L", () => {
    const k = los([4000], { q: [0], punten: [{ a: 2000, P: 30 }] }, EI);
    expect(k.Mmax).toBeCloseTo(30, 3);
    expect(k.delta[0]).toBeCloseTo((30000 * 4000 ** 3) / (48 * EI), 1);
    const k2 = los([4000], { q: [0], punten: [{ a: 1000, P: 40 }] });
    expect(k2.R[0]).toBeCloseTo(30, 3);
    expect(k2.R[1]).toBeCloseTo(10, 3);
    expect(k2.Mmax).toBeCloseTo((40 * 1000 * 3000) / 4000 / 1000, 3); // P·a·b/L
  });

  it("twee gelijke overspanningen: M_B = −qL²/8, R = 3/8·qL, 10/8·qL, 3/8·qL; veldmoment 9/128·qL²", () => {
    const k = los([4000, 4000], { q: [10, 10], punten: [] }, EI);
    expect(k.Mmin).toBeCloseTo(-20, 3);
    expect(k.R[0]).toBeCloseTo(15, 3);
    expect(k.R[1]).toBeCloseTo(50, 3);
    expect(k.R[2]).toBeCloseTo(15, 3);
    expect(k.Mmax).toBeCloseTo((9 / 128) * 10 * 16, 2); // 11,25 kNm
    // doorbuiging: qL⁴/(185·EI)
    expect(k.delta[0]).toBeCloseTo((10 * 4000 ** 4) / (185 * EI), 1);
  });

  it("twee overspanningen, puntlast midden van overspanning 1: M_B = −3PL/32", () => {
    const k = los([4000, 4000], { q: [0, 0], punten: [{ a: 2000, P: 32 }] });
    expect(k.Mmin).toBeCloseTo((-3 * 32 * 4) / 32, 3); // −12 kNm
    expect(k.R.reduce((s, x) => s + x, 0)).toBeCloseTo(32, 6);
  });
});
