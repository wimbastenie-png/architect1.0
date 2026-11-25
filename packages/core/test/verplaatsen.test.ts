import { describe, expect, it } from "vitest";
import { appartement } from "../examples/appartement.ts";
import {
  afstandVanafA,
  controleerSamenhang,
  lastenboek,
  meetstaat,
  muurBijPunt,
  muurOmschrijving,
  verdiepingNaarSVG,
  verplaatsOpening,
  wijzigOpening,
  type Verdieping,
} from "../src/index.ts";

const v0 = appartement.verdiepingen[0]!;
const metV = (v: Verdieping) => ({ ...appartement, verdiepingen: [v] });
const raam = (v: Verdieping) => v.openingen.find((o) => o.id === "o-raam-leef")!;

describe("raam of deur naar een andere muur", () => {
  it("naar de bovenste muur, op 1000 mm van hoek A", () => {
    const v = verplaatsOpening(v0, "o-raam-leef", "m-boven-links", 1000);
    expect(raam(v).muurId).toBe("m-boven-links");
    expect(afstandVanafA(v, raam(v))).toBe(1000);
    expect(raam(v).offset).toBe(1050); // + 50: halve binnenmuur bij hoek A
    expect(controleerSamenhang(metV(v))).toEqual([]);
    // nog altijd een buitenmuur van de leefruimte: wandvlak blijft gelijk
    const leef = (p: typeof appartement) => meetstaat(p).find((r) => r.ruimte === "Leefruimte")!.wandNettoM2;
    expect(leef(metV(v))).toBe(leef(appartement));
  });
  it("zonder afstand: in het midden van de muur", () => {
    const v = verplaatsOpening(v0, "o-raam-leef", "m-boven-links");
    expect(afstandVanafA(v, raam(v))).toBe((5800 - 2400) / 2);
  });
  it("naar een tussenmuur: geen vensterbank en dagkanten meer in het lastenboek", () => {
    const v = verplaatsOpening(v0, "o-raam-leef", "m-binnen", 500);
    const post = (p: typeof appartement, code: string) => lastenboek(p).totalen.find((t) => t.code === code)?.hoeveelheid ?? 0;
    expect(post(metV(v), "08")).toBe(1.6); // enkel het slaapkamerraam
    expect(post(metV(v), "08")).toBeLessThan(post(appartement, "08"));
    expect(controleerSamenhang(metV(v))).toEqual([]);
  });
  it("weigert te breed en overlap; origineel blijft ongemoeid", () => {
    const breed = wijzigOpening(v0, "o-raam-leef", { breedte: 5000, offset: 200 });
    expect(() => verplaatsOpening(breed, "o-raam-leef", "m-links")).toThrow(/breder dan de muur/);
    expect(() => verplaatsOpening(v0, "o-raam-leef", "m-links", 800)).toThrow(/overlapt/);
    expect(raam(v0).muurId).toBe("m-onder-links");
  });
});

describe("muren benoemen en terugvinden", () => {
  it("leesbare namen", () => {
    expect(muurOmschrijving(v0, "m-links")).toBe("Leefruimte — linkse muur · 4500 mm");
    expect(muurOmschrijving(v0, "m-binnen")).toBe("Tussenmuur Leefruimte / Slaapkamer · 4500 mm");
    expect(muurOmschrijving(v0, "m-onder-rechts")).toBe("Slaapkamer — onderste muur · 3400 mm");
    expect(muurOmschrijving(v0, "m-boven-links")).toBe("Leefruimte — bovenste muur · 5800 mm");
  });
  it("muur bij een punt", () => {
    expect(muurBijPunt(v0, { x: 3000, y: -100 })!.muurId).toBe("m-onder-links");
    expect(muurBijPunt(v0, { x: 3000, y: -100 })!.t).toBe(3000);
    expect(muurBijPunt(v0, { x: 6020, y: 2000 })!.muurId).toBe("m-binnen");
    expect(muurBijPunt(v0, { x: 3000, y: 2400 })).toBeNull(); // midden in de leefruimte
  });
});

describe("SVG voor slepen", () => {
  it("openingen herkenbaar, coördinaten terug te rekenen, geselecteerde muur sleepbaar", () => {
    const svg = verdiepingNaarSVG(v0, { interactief: true, geselecteerd: "m-onder-links", opening: "o-raam-leef" });
    expect(svg).toContain('data-opening="o-raam-leef"');
    for (const k of ["data-min-x", "data-max-x", "data-min-y", "data-max-y"]) expect(svg).toMatch(new RegExp(`${k}="-?\\d+(\\.\\d+)?"`));
    expect(svg).toContain("cursor:grab"); // geselecteerde muur: grijp-cursor
    expect(svg).toContain("#fde68a"); // gemarkeerde opening
    // scrollen wordt nooit door de tekening zelf geblokkeerd (enkel tijdens het slepen, in de webapp)
    expect(svg).not.toContain("touch-action");
  });
});

describe("aanraakzones", () => {
  it("brede onzichtbare lijnen langs muren en openingen, ruime hoekzone; niet in exports", () => {
    const svg = verdiepingNaarSVG(v0, { interactief: true, raak: 600, geselecteerd: "m-rechts" });
    expect(svg).toMatch(/<line [^>]*stroke="transparent" stroke-width="1200" pointer-events="stroke" data-raak="1" data-muur="m-binnen"/);
    expect(svg).toMatch(/data-raak="1" data-muur="m-onder-links" data-opening="o-raam-leef"/);
    expect(svg).toMatch(/<circle [^>]*r="600" fill="transparent" pointer-events="all" data-hoek="9600,4800"/);
    // zonder raak of niet-interactief (PDF/voorbeeld): geen aanraaklaag
    expect(verdiepingNaarSVG(v0, { interactief: true })).not.toContain("data-raak");
    expect(verdiepingNaarSVG(v0, { raak: 600 })).not.toContain("data-raak");
  });
});
