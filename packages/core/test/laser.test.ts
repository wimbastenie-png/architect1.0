import { describe, expect, it } from "vitest";
import { LASERS, leesBosch, leesLeica, leesMeting, naarMm } from "../src/index.ts";

const f32 = (m: number) => { const d = new DataView(new ArrayBuffer(4)); d.setFloat32(0, m, true); return d; };
function boschFrame(m: number, kop = [0xc0, 0x55, 0x10, 0x06]) {
  const d = new DataView(new ArrayBuffer(16));
  kop.forEach((b, i) => d.setUint8(i, b));
  d.setFloat32(7, m, true);
  return d;
}

describe("laser", () => {
  it("Leica DISTO: float32 in meter", () => {
    expect(naarMm(leesLeica(f32(3.215))!)).toBe(3215);
    expect(leesLeica(f32(0))).toBeNull();
    expect(leesLeica(f32(NaN))).toBeNull();
    expect(leesLeica(new DataView(new ArrayBuffer(2)))).toBeNull();
  });
  it("Bosch GLM: meetbericht C0 55 10 06, afstand op byte 7", () => {
    expect(naarMm(leesBosch(boschFrame(2.48))!)).toBe(2480);
    expect(naarMm(leesMeting("bosch", boschFrame(12.005))!)).toBe(12005);
  });
  it("Bosch GLM: andere berichten en onzin worden genegeerd", () => {
    expect(leesBosch(boschFrame(2.48, [0xc0, 0x55, 0x02, 0x01]))).toBeNull(); // bevestiging
    expect(leesBosch(new DataView(new ArrayBuffer(6)))).toBeNull();
    expect(leesBosch(boschFrame(9999))).toBeNull(); // buiten bereik
  });
  it("elk protocol heeft een service, een meting en een naam", () => {
    for (const l of LASERS) {
      expect(l.service).toMatch(/^[0-9a-f-]{36}$/);
      expect(l.meting).toMatch(/^[0-9a-f-]{36}$/);
      expect(l.namen.length).toBeGreaterThan(0);
    }
  });
});
