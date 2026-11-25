import { describe, expect, it } from "vitest";
import { appartement } from "../examples/appartement.ts";
import {
  binnenLengte,
  breekMuurUit,
  controleerSamenhang,
  lastenboek,
  maatketens,
  meetstaat,
  muurLengte,
  muurVorm,
  oppervlakte,
  rechthoekigProject,
  richtingLabel,
  verdiepingNaarDXF,
  verdiepingNaarSVG,
  verplaatsHoek,
  verschuifMuur,
  verschuifRichtingen,
  voegRuimteToe,
  wijzigOpening,
  zelfkruisend,
  type Verdieping,
} from "../src/index.ts";

// Rechthoek 4000 × 3000 binnen, muren 200; hartlijnen op −100 … 4100 × −100 … 3100.
const basis = rechthoekigProject({ naam: "Trapezium", ruimteNaam: "Living", binnenBreedte: 4000, binnenDiepte: 3000, plafondhoogte: 2600, muurdikte: 200, nu: "2026-11-25T10:00:00Z" });
const r0 = basis.verdiepingen[0]!;
const metV = (v: Verdieping) => ({ ...basis, verdiepingen: [v] });
// hoek rechtsboven 1000 mm naar rechts → rechtermuur schuin, richting (1000, 3200)
const schuin = verplaatsHoek(r0, { x: 4100, y: 3100 }, { x: 5100, y: 3100 });

// Verwachte waarden, los van de code uitgerekend:
const L = Math.hypot(1000, 3200);
const verschuiving = (100 * L) / 3200; // binnenvlak ligt 104,77 mm horizontaal naast de as
const xOnder = 4100 + 100 * (1000 / 3200) - verschuiving; // 4026,48
const xBoven = 4100 + 3100 * (1000 / 3200) - verschuiving; // 4964,00
const verwachtOpp = (3000 * (xOnder + xBoven)) / 2; // 13,4857 m² → 13,49

describe("hoek verplaatsen → schuine muur", () => {
  it("rechthoek wordt trapezium met het juiste binnenoppervlak", () => {
    const r = schuin.ruimtes[0]!;
    expect(r.contour).toHaveLength(4);
    expect(Math.abs(oppervlakte(r.contour) - verwachtOpp)).toBeLessThan(3000 * 2); // afronding op hele mm
    expect(meetstaat(metV(schuin))[0]!.vloerM2).toBe(13.49);
    expect(controleerSamenhang(metV(schuin))).toEqual([]);
    expect(zelfkruisend(r.contour)).toBe(false);
  });
  it("binnenmaten langs de muren volgen de schuine hoek", () => {
    const boven = schuin.muren.find((m) => m.id === "m-boven")!;
    const onder = schuin.muren.find((m) => m.id === "m-onder")!;
    const rechts = schuin.muren.find((m) => m.id === "m-rechts")!;
    expect(binnenLengte(boven, schuin.muren)).toBeCloseTo(xBoven, 0);
    expect(binnenLengte(onder, schuin.muren)).toBeCloseTo(xOnder, 0);
    // schuine binnenmaat = lengte van het binnenvlak tussen boven- en ondervlak
    expect(binnenLengte(rechts, schuin.muren)).toBeCloseTo(Math.hypot(xBoven - xOnder, 3000), 0);
    expect(rechts.bron.methode).toBe("gecorrigeerd");
  });
  it("hoeken sluiten: de verstekpunten van twee muren vallen samen", () => {
    const vorm = (id: string) => muurVorm(schuin.muren.find((m) => m.id === id)!, schuin.muren);
    const rechts = vorm("m-rechts"), boven = vorm("m-boven");
    // rechts eindigt in de hoek waar boven begint: beide vlakken moeten dezelfde punten hebben
    const punten = (p: { x: number; y: number }[]) => p.map((q) => `${q.x.toFixed(3)},${q.y.toFixed(3)}`);
    const gedeeld = punten(rechts).filter((p) => punten(boven).includes(p));
    expect(gedeeld).toHaveLength(2);
  });
  it("haaks blijft haaks: rechthoekige hoek geeft ±dikte/2 zoals vroeger", () => {
    const onder = r0.muren.find((m) => m.id === "m-onder")!;
    expect(binnenLengte(onder, r0.muren)).toBe(4000);
    expect(muurVorm(onder, r0.muren).map((p) => [Math.round(p.x), Math.round(p.y)])).toEqual([[0, 0], [4000, 0], [4200, -200], [-200, -200]]);
  });
  it("weigert punten met drie muren, omklappen en een hoek op een andere hoek", () => {
    const v0 = appartement.verdiepingen[0]!;
    expect(() => verplaatsHoek(v0, { x: 6000, y: 0 }, { x: 6000, y: -500 })).toThrow(/meer dan twee muren/);
    expect(() => verplaatsHoek(r0, { x: 4100, y: 3100 }, { x: -3000, y: 3100 })).toThrow(/klapt|kruisen/);
    expect(() => verplaatsHoek(r0, { x: 4100, y: 3100 }, { x: -100, y: 3100 })).toThrow(/andere hoek/);
  });
  it("raam blijft op dezelfde afstand van het vaste uiteinde", () => {
    // m-boven loopt van rechtsboven (4100,3100) naar linksboven (−100,3100)
    const met = { ...r0, openingen: [{ id: "o-r", muurId: "m-boven", soort: "raam" as const, offset: 2000, breedte: 1000, hoogte: 1200, borstwering: 900, bron: { methode: "manueel" as const } }] };
    const v = verplaatsHoek(met, { x: 4100, y: 3100 }, { x: 5100, y: 3100 });
    const boven = v.muren.find((m) => m.id === "m-boven")!;
    const o = v.openingen[0]!;
    // afstand tot het vaste uiteinde (linksboven): 4200 − 2000 − 1000 = 1200, ook na het verplaatsen
    expect(muurLengte(boven) - o.offset - o.breedte).toBe(1200);
  });
});

describe("maatkettingen langs een schuine gevel", () => {
  it("eigen zijde evenwijdig aan de schuine gevel, met de lengte van het buitenvlak", () => {
    const k = maatketens(schuin);
    const s = k.filter((m) => Math.abs(m.n.x) > 0.1 && Math.abs(m.n.y) > 0.1);
    expect(s.length).toBe(1);
    // buitenvlak: van het ondervlak (y = −200) tot het bovenvlak (y = 3200), schuin gemeten
    expect(s[0]!.lengte).toBeCloseTo((3400 * L) / 3200, 0);
    // de maatlijn ligt buiten het gebouw, evenwijdig aan de gevel
    const rand = Math.max(...schuin.muren.flatMap((m) => muurVorm(m, schuin.muren)).map((p) => p.x * s[0]!.n.x + p.y * s[0]!.n.y));
    expect(s[0]!.a.x * s[0]!.n.x + s[0]!.a.y * s[0]!.n.y).toBeGreaterThan(rand);
  });
  it("ramen in een schuine gevel komen in de openingenketting", () => {
    const v = { ...schuin, openingen: [{ id: "o-s", muurId: "m-rechts", soort: "raam" as const, offset: 1000, breedte: 900, hoogte: 1200, borstwering: 900, bron: { methode: "manueel" as const } }] };
    const rij0 = maatketens(v).filter((m) => m.rij === 0 && Math.abs(m.n.x) > 0.1 && Math.abs(m.n.y) > 0.1);
    expect(rij0.map((m) => Math.round(m.lengte))).toContain(900);
    const totaal = rij0.reduce((s, m) => s + m.lengte, 0);
    expect(totaal).toBeCloseTo((3400 * L) / 3200, 0);
  });
  it("onderzijde loopt tot het verstekpunt met het schuine buitenvlak", () => {
    // ondervlak y = −200; daar ligt de schuine as op x = 4100 − 100 × 1000/3200 = 4068,75,
    // het buitenvlak 104,77 mm verder: x = 4173,52 → maat van −200 tot 4173,52 = 4373,5
    const onder = maatketens(schuin).filter((m) => m.n.y < -0.99);
    expect(onder.map((m) => Math.round(m.lengte))).toEqual([Math.round(200 + 4100 - 100 * (1000 / 3200) + verschuiving)]);
  });
});

describe("andere bewerkingen met schuine muren", () => {
  it("schuine muur verschuiven en richtingen in woorden", () => {
    const m = schuin.muren.find((x) => x.id === "m-rechts")!;
    const labels = verschuifRichtingen(m).map((r) => r.label);
    // normaal van de schuine muur (1000, 3200 omhoog): links ≈ (−0,95; 0,30) → "naar links"
    expect(labels).toEqual(["naar links", "naar rechts"]);
    expect(labels.every((l) => /^naar (rechts|links|boven|onder|rechtsboven|linksboven|linksonder|rechtsonder)$/.test(l))).toBe(true);
    expect(richtingLabel(1, 0)).toBe("naar rechts");
    expect(richtingLabel(0.7, -0.7)).toBe("naar rechtsonder");
    const v = verschuifMuur(schuin, "m-rechts", -200); // naar buiten (rechts)
    expect(oppervlakte(v.ruimtes[0]!.contour)).toBeGreaterThan(oppervlakte(schuin.ruimtes[0]!.contour));
    expect(controleerSamenhang(metV(v))).toEqual([]);
  });
  it("ruimte tegen een schuine muur en uitbreken tot één ruimte", () => {
    const binnen = binnenLengte(schuin.muren.find((m) => m.id === "m-rechts")!, schuin.muren);
    const v1 = voegRuimteToe(schuin, { muurId: "m-rechts", naam: "Serre", breedte: Math.floor(binnen), diepte: 2000, plafondhoogte: 2600 });
    expect(controleerSamenhang(metV(v1))).toEqual([]);
    const serre = v1.ruimtes.find((r) => r.naam === "Serre")!;
    const v2 = breekMuurUit(v1, "m-rechts");
    expect(v2.ruimtes).toHaveLength(1);
    const samen = v2.ruimtes[0]!;
    const verwacht = oppervlakte(schuin.ruimtes[0]!.contour) + oppervlakte(serre.contour) + Math.floor(binnen) * 200;
    expect(Math.abs(oppervlakte(samen.contour) - verwacht)).toBeLessThan(verwacht * 0.002 + 20000);
    expect(zelfkruisend(samen.contour)).toBe(false);
    expect(controleerSamenhang(metV(v2))).toEqual([]);
  });
  it("tekenen, lastenboek en raam in schuine muur", () => {
    const v = wijzigOpening({ ...schuin, openingen: [{ id: "o-s", muurId: "m-rechts", soort: "raam", offset: 1000, breedte: 900, hoogte: 1200, borstwering: 900, bron: { methode: "manueel" } }] }, "o-s", { offset: 1200 });
    expect(verdiepingNaarSVG(v)).toContain("Living");
    expect(verdiepingNaarDXF(v)).toContain("MUREN");
    expect(lastenboek(metV(v)).totalen.find((t) => t.code === "08")!.hoeveelheid).toBe(0.9);
  });
});

describe("vast tekenkader tijdens het slepen", () => {
  it("met een kader verandert het beeld niet van schaal als het plan groeit", () => {
    const kader = { minX: -2000, maxX: 7000, minY: -2000, maxY: 5000 };
    const a = verdiepingNaarSVG(r0, { kader }), b = verdiepingNaarSVG(schuin, { kader });
    const vb = (s: string) => s.match(/viewBox="([^"]+)"/)![1];
    expect(vb(a)).toBe(vb(b));
    expect(a).toContain('data-min-x="-2000" data-max-x="7000" data-min-y="-2000" data-max-y="5000"');
    expect(vb(verdiepingNaarSVG(r0))).not.toBe(vb(verdiepingNaarSVG(schuin)));
  });
});
