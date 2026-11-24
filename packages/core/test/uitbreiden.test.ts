import { describe, expect, it } from "vitest";
import { appartement } from "../examples/appartement.ts";
import {
  binnenLengte,
  controleerSamenhang,
  maatlijnen,
  meetstaat,
  oppervlakte,
  rechthoekigProject,
  voegRuimteToe,
  zetBinnenLengte,
  type Project,
  type Verdieping,
} from "../src/index.ts";

const badkamer = rechthoekigProject({
  naam: "Test", ruimteNaam: "Badkamer", binnenBreedte: 2400, binnenDiepte: 1800,
  plafondhoogte: 2500, muurdikte: 140, nu: "2026-11-24T10:00:00Z",
});
const b0 = badkamer.verdiepingen[0]!;
const metV = (p: Project, v: Verdieping): Project => ({ ...p, verdiepingen: [v] });

describe("ruimte toevoegen", () => {
  it("zet een ruimte over de volle breedte tegen een muur, zonder splitsing", () => {
    const v = voegRuimteToe(b0, { muurId: "m-rechts", naam: "Berging", breedte: 1800, diepte: 2000, plafondhoogte: 2500 });
    expect(v.muren).toHaveLength(7);
    expect(v.ruimtes).toHaveLength(2);
    const berging = v.ruimtes.find((r) => r.naam === "Berging")!;
    expect(oppervlakte(berging.contour)).toBe(1800 * 2000);
    expect(controleerSamenhang(metV(badkamer, v))).toEqual([]);
    // tussenmuur hoort bij beide ruimtes en krijgt geen buitenmaatlijn meer
    expect(v.ruimtes.every((r) => r.muurIds.includes("m-rechts"))).toBe(true);
    const ml = maatlijnen(v);
    expect(ml.some((x) => x.muurId === "m-rechts")).toBe(false);
    // buitenmaten onderaan tellen op tot 140 + 2400 + 140 + 2000 + 140
    const onder = ml.filter((x) => Math.abs(x.a.y - x.b.y) < 1 && x.a.y < 0).reduce((s, x) => s + x.lengte, 0);
    expect(onder).toBe(4820);
  });

  it("splitst de muur als de nieuwe ruimte smaller is, en verhuist openingen", () => {
    const v0 = appartement.verdiepingen[0]!;
    // raam op m-onder-links ligt van 1500 tot 3900 vanaf de hartlijnstart (0,0)
    const v = voegRuimteToe(v0, {
      muurId: "m-onder-links", naam: "Veranda", breedte: 1000, diepte: 2500, afstandVanafA: 4500,
      muurdikte: 200, plafondhoogte: 2500,
    });
    expect(controleerSamenhang(metV(appartement, v))).toEqual([]);
    const veranda = v.ruimtes.find((r) => r.naam === "Veranda")!;
    expect(oppervlakte(veranda.contour)).toBe(1000 * 2500);
    // muur in 3 stukken + 3 nieuwe muren
    expect(v.muren).toHaveLength(7 + 2 + 3);
    const raam = v.openingen.find((o) => o.id === "o-raam-leef")!;
    expect(raam.muurId).toBe("m-onder-links");
    expect(raam.offset).toBe(1500);
    // leefruimte: zelfde oppervlak en wandoppervlak als vroeger
    const voor = meetstaat(appartement).find((r) => r.ruimte === "Leefruimte")!;
    const na = meetstaat(metV(appartement, v)).find((r) => r.ruimte === "Leefruimte")!;
    expect(na.vloerM2).toBe(voor.vloerM2);
    expect(na.wandNettoM2).toBe(voor.wandNettoM2);
    // veranda ligt buiten (onder) het appartement
    expect(Math.max(...veranda.contour.map((p) => p.y))).toBeLessThanOrEqual(-150);
  });

  it("weigert als een raam over een nieuwe zijmuur zou lopen", () => {
    const v0 = appartement.verdiepingen[0]!;
    expect(() =>
      voegRuimteToe(v0, { muurId: "m-onder-links", naam: "X", breedte: 1000, diepte: 2000, afstandVanafA: 2000, plafondhoogte: 2500 }),
    ).toThrow(/raam/);
  });

  it("weigert tussenmuren, te brede ruimtes en overlap", () => {
    const v0 = appartement.verdiepingen[0]!;
    expect(() => voegRuimteToe(v0, { muurId: "m-binnen", naam: "X", breedte: 1000, diepte: 1000, plafondhoogte: 2500 })).toThrow(/twee ruimtes/);
    expect(() => voegRuimteToe(b0, { muurId: "m-onder", naam: "X", breedte: 3000, diepte: 1000, plafondhoogte: 2500 })).toThrow(/past niet/);
    const v = voegRuimteToe(b0, { muurId: "m-rechts", naam: "A", breedte: 1800, diepte: 2000, plafondhoogte: 2500 });
    // nieuwe ruimte onder de badkamer die doorloopt onder de berging → zou niet overlappen;
    // maar een ruimte op de verre muur van A naar binnen kan niet: kies m-onder van badkamer met diepte die in A doorsteekt? → test overlap direct:
    const verMuur = v.muren.find((m) => m.id.startsWith("m-ver"))!;
    const v2 = voegRuimteToe(v, { muurId: verMuur.id, naam: "B", breedte: 1800, diepte: 1500, plafondhoogte: 2500 });
    expect(v2.ruimtes).toHaveLength(3);
    expect(() => voegRuimteToe(v2, { muurId: verMuur.id, naam: "C", breedte: 500, diepte: 500, plafondhoogte: 2500 })).toThrow(/twee ruimtes/);
  });

  it("aanbouw tegen een gevel: maat vanaf de gevel, maatlijnen buiten de aanbouw", () => {
    const v0 = appartement.verdiepingen[0]!;
    const v = voegRuimteToe(v0, { muurId: "m-rechts", naam: "Berging", breedte: 2000, diepte: 1500, afstandVanafA: 1000, muurdikte: 200, plafondhoogte: 2400 });
    const berging = v.ruimtes.find((r) => r.naam === "Berging")!;
    const zij = v.muren.filter((m) => m.id.startsWith("m-zij"));
    const ml = maatlijnen(v).filter((x) => zij.some((z) => z.id === x.muurId));
    expect(ml).toHaveLength(2);
    for (const x of ml) {
      expect(x.lengte).toBe(1500 + 200); // gevel → buitenkant aanbouw
      // maatlijn ligt buiten de berging (boven of onder)
      const ys = berging.contour.map((p) => p.y);
      expect(x.a.y > Math.max(...ys) || x.a.y < Math.min(...ys)).toBe(true);
    }
  });

  it("verspringende gevel: maat van gevelvlak tot gevelvlak", () => {
    const p = rechthoekigProject({ naam: "x", binnenBreedte: 2400, binnenDiepte: 1800, plafondhoogte: 2600, muurdikte: 200 });
    let v = p.verdiepingen[0]!;
    v = voegRuimteToe(v, { muurId: "m-rechts", naam: "Slaapkamer", breedte: 1800, diepte: 3200, plafondhoogte: 2600 });
    v = voegRuimteToe(v, { muurId: "m-boven", naam: "Gang", breedte: 2400, diepte: 1200, plafondhoogte: 2600 });
    const gang = v.ruimtes.find((r) => r.naam === "Gang")!;
    // rechtermuur van de gang ligt in het verlengde van de tussenmuur badkamer/slaapkamer
    const rechts = v.muren.find((m) => gang.muurIds.includes(m.id) && m.start.x === 2500 && m.eind.x === 2500)!;
    expect(maatlijnen(v).find((x) => x.muurId === rechts.id)!.lengte).toBe(1200 + 200);
    expect(controleerSamenhang({ ...p, verdiepingen: [v] })).toEqual([]);
  });

  it("twee ruimtes naast elkaar onder het appartement delen één muur", () => {
    const v0 = appartement.verdiepingen[0]!;
    const v1 = voegRuimteToe(v0, { muurId: "m-onder-links", naam: "Garage", breedte: 5800, diepte: 3000, plafondhoogte: 2500 });
    const v2 = voegRuimteToe(v1, { muurId: "m-onder-rechts", naam: "Atelier", breedte: 3400, diepte: 3000, plafondhoogte: 2500 });
    expect(controleerSamenhang(metV(appartement, v2))).toEqual([]);
    const garage = v2.ruimtes.find((r) => r.naam === "Garage")!;
    const atelier = v2.ruimtes.find((r) => r.naam === "Atelier")!;
    expect(oppervlakte(garage.contour)).toBe(5800 * 3000);
    expect(oppervlakte(atelier.contour)).toBe(3400 * 3000);
    // de muur tussen garage en atelier is het verlengde van de binnenmuur (100 mm) en wordt gedeeld
    const gedeeld = garage.muurIds.filter((id) => atelier.muurIds.includes(id));
    expect(gedeeld).toHaveLength(1);
    expect(v2.muren.find((m) => m.id === gedeeld[0])!.dikte).toBe(100);
    // 7 bestaande + 3 (garage) + 2 (atelier: zijmuur hergebruikt)
    expect(v2.muren).toHaveLength(12);
    // andere diepte → weigeren in plaats van muren te laten overlappen
    expect(() => voegRuimteToe(v1, { muurId: "m-onder-rechts", naam: "X", breedte: 3400, diepte: 2000, plafondhoogte: 2500 })).toThrow(/al een muur/);
  });

  it("binnenmaat van de nieuwe ruimte blijft aanpasbaar", () => {
    const v = voegRuimteToe(b0, { muurId: "m-rechts", naam: "Berging", breedte: 1800, diepte: 2000, plafondhoogte: 2500 });
    const ver = v.muren.find((m) => m.id.startsWith("m-ver"))!;
    expect(binnenLengte(ver, v.muren)).toBe(1800);
    const zij = v.muren.find((m) => m.id.startsWith("m-zij"))!;
    expect(binnenLengte(zij, v.muren)).toBe(2000);
    const v2 = zetBinnenLengte(v, zij.id, 2200, "start");
    const berging = v2.ruimtes.find((r) => r.naam === "Berging")!;
    expect(oppervlakte(berging.contour)).toBe(1800 * 2200);
    expect(controleerSamenhang(metV(badkamer, v2))).toEqual([]);
  });
});
