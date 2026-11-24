import { describe, expect, it } from "vitest";
import { appartement } from "../examples/appartement.ts";
import {
  binnenLengte,
  controleerSamenhang,
  maatlijnen,
  meetstaat,
  oppervlakte,
  rechthoekigProject,
  verdiepingNaarSVG,
  zetBinnenLengte,
} from "../src/index.ts";

const v0 = appartement.verdiepingen[0]!;
const muur = (v: typeof v0, id: string) => v.muren.find((m) => m.id === id)!;

describe("binnenmaten", () => {
  it("rekent hartlijn om naar binnenmaat", () => {
    expect(binnenLengte(muur(v0, "m-onder-links"), v0.muren)).toBe(5800);
    expect(binnenLengte(muur(v0, "m-onder-rechts"), v0.muren)).toBe(3400);
    expect(binnenLengte(muur(v0, "m-binnen"), v0.muren)).toBe(4500);
  });

  it("zet een binnenmaat en markeert de meetbron", () => {
    const v = zetBinnenLengte(v0, "m-onder-rechts", 3450, "start", "laser");
    expect(binnenLengte(muur(v, "m-onder-rechts"), v.muren)).toBe(3450);
    expect(oppervlakte(v.ruimtes.find((r) => r.id === "r-slaap")!.contour)).toBe(3450 * 4500);
    expect(muur(v, "m-onder-rechts").bron.methode).toBe("laser");
  });
});

describe("rechthoekig project", () => {
  const p = rechthoekigProject({
    naam: "Badkamer", ruimteNaam: "Badkamer", binnenBreedte: 2400, binnenDiepte: 1800,
    plafondhoogte: 2500, muurdikte: 140, nu: "2026-11-24T10:00:00Z",
  });
  const v = p.verdiepingen[0]!;

  it("heeft de ingegeven binnenmaten", () => {
    expect(oppervlakte(v.ruimtes[0]!.contour)).toBe(2400 * 1800);
    expect(binnenLengte(muur(v, "m-onder"), v.muren)).toBe(2400);
    expect(binnenLengte(muur(v, "m-rechts"), v.muren)).toBe(1800);
    expect(controleerSamenhang(p)).toEqual([]);
    expect(meetstaat(p)[0]!.vloerM2).toBe(4.32);
    expect(meetstaat(p)[0]!.bron).toBe("manueel");
  });

  it("blijft rechthoekig na een maatwijziging", () => {
    const v2 = zetBinnenLengte(v, "m-onder", 2500);
    expect(binnenLengte(muur(v2, "m-boven"), v2.muren)).toBe(2500);
    expect(oppervlakte(v2.ruimtes[0]!.contour)).toBe(2500 * 1800);
  });
});

describe("buitenmaten", () => {
  it("deelmaten tellen op tot de totale buitenmaat", () => {
    const ml = maatlijnen(v0);
    const onder = ml.filter((x) => x.muurId.startsWith("m-onder")).map((x) => x.lengte).sort();
    expect(onder).toEqual([3750, 6150]);
    expect(onder[0]! + onder[1]!).toBe(9900);
    expect(ml.find((x) => x.muurId === "m-links")!.lengte).toBe(5100);
    expect(ml.some((x) => x.muurId === "m-binnen")).toBe(false);
  });

  it("rechthoek: buitenmaat = binnenmaat + 2 × muurdikte", () => {
    const p = rechthoekigProject({ naam: "x", binnenBreedte: 2500, binnenDiepte: 1800, plafondhoogte: 2500, muurdikte: 140 });
    const ml = maatlijnen(p.verdiepingen[0]!);
    expect(ml.find((x) => x.muurId === "m-onder")!.lengte).toBe(2780);
    expect(ml.find((x) => x.muurId === "m-rechts")!.lengte).toBe(2080);
  });
});

describe("interactieve SVG", () => {
  it("markeert de geselecteerde muur met A en B", () => {
    const svg = verdiepingNaarSVG(v0, { interactief: true, geselecteerd: "m-binnen" });
    expect(svg).toContain('data-muur="m-binnen"');
    expect(svg).toContain('data-ruimte="r-leef"');
    expect(svg).toContain(">A</text>");
    expect(svg).toContain("#dc2626");
    expect(verdiepingNaarSVG(v0)).not.toContain("data-muur");
  });
});
