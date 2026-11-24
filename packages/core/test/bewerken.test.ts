import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { appartement } from "../examples/appartement.ts";
import {
  binnenLengte,
  breekMuurUit,
  controleerSamenhang,
  euro,
  haaksMaken,
  lastenboek,
  lastenboekCSV,
  lastenboekTSV,
  leesPrijzen,
  leesProject,
  meetstaat,
  oppervlakte,
  projectNaarPDF,
  projectUitHoekpunten,
  raming,
  verdiepingNaarDXF,
  verdiepingNaarSVG,
  verwijderOpening,
  verwijderRuimte,
  verwijderSparing,
  voegRuimteToe,
  voegSparingToe,
  voegVerdiepingToe,
  wijzigOpening,
  type Project,
  type Verdieping,
} from "../src/index.ts";

const v0 = appartement.verdiepingen[0]!;
const metV = (v: Verdieping, p: Project = appartement): Project => ({ ...p, verdiepingen: [v] });

describe("openingen bewerken", () => {
  it("verplaatst en wijzigt een raam", () => {
    const v = wijzigOpening(v0, "o-raam-leef", { offset: 1000, breedte: 2000 });
    const o = v.openingen.find((x) => x.id === "o-raam-leef")!;
    expect([o.offset, o.breedte]).toEqual([1000, 2000]);
    expect(controleerSamenhang(metV(v))).toEqual([]);
  });
  it("weigert buiten de muur, overlap en te hoog", () => {
    expect(() => wijzigOpening(v0, "o-raam-leef", { offset: 100 })).toThrow(/past niet/); // vóór de binnenhoek (150)
    expect(() => wijzigOpening(v0, "o-raam-leef", { offset: 4000 })).toThrow(/past niet/);
    const v = { ...v0, openingen: [...v0.openingen, { ...v0.openingen[0]!, id: "o-2", offset: 4200, breedte: 800 }] };
    expect(() => wijzigOpening(v, "o-2", { offset: 3500 })).toThrow(/overlapt/);
    expect(() => wijzigOpening(v0, "o-raam-leef", { hoogte: 2500 })).toThrow(/hoger/);
  });
  it("verwijdert een opening", () => {
    expect(verwijderOpening(v0, "o-voordeur").openingen).toHaveLength(3);
  });
});

describe("muur uitbreken", () => {
  it("leefruimte + slaapkamer worden één ruimte", () => {
    const v = breekMuurUit(v0, "m-binnen");
    expect(v.ruimtes).toHaveLength(1);
    const r = v.ruimtes[0]!;
    expect(r.naam).toBe("Leefruimte + Slaapkamer");
    expect(oppervlakte(r.contour)).toBe(9300 * 4500); // 5800 + 100 + 3400
    expect(v.muren.some((m) => m.id === "m-binnen")).toBe(false);
    expect(v.openingen.some((o) => o.id === "o-binnendeur")).toBe(false);
    expect(controleerSamenhang(metV(v))).toEqual([]);
    // wandoppervlak: omtrek 2 × (9300 + 4500) × 2,7 − ramen − voordeur
    expect(meetstaat(metV(v))[0]!.wandBrutoM2).toBe(74.52);
  });
  it("weigert buitenmuren en ongelijke ruimtes", () => {
    expect(() => breekMuurUit(v0, "m-links")).toThrow(/tussen twee ruimtes/);
    const v = voegRuimteToe(v0, { muurId: "m-onder-links", naam: "Berging", breedte: 1000, diepte: 1500, afstandVanafA: 0, plafondhoogte: 2500 });
    const tussen = v.ruimtes.find((r) => r.naam === "Berging")!.muurIds.find((id) => v.ruimtes.filter((r) => r.muurIds.includes(id)).length === 2)!;
    expect(() => breekMuurUit(v, tussen)).toThrow(/even breed/);
  });
});

describe("ruimte verwijderen", () => {
  it("verwijdert eigen muren, houdt gedeelde muren", () => {
    const v1 = voegRuimteToe(v0, { muurId: "m-rechts", naam: "Berging", breedte: 2000, diepte: 1500, afstandVanafA: 1000, plafondhoogte: 2400 });
    const berging = v1.ruimtes.find((r) => r.naam === "Berging")!;
    const v = verwijderRuimte(v1, berging.id);
    expect(v.ruimtes).toHaveLength(2);
    expect(v.muren.length).toBe(v1.muren.length - 3); // 3 eigen muren weg, gesplitste gevel blijft
    expect(controleerSamenhang(metV(v))).toEqual([]);
    expect(meetstaat(metV(v)).map((r) => r.vloerM2)).toEqual([26.1, 15.3]);
  });
  it("niet de laatste ruimte", () => {
    const v = verwijderRuimte(v0, "r-slaap");
    expect(() => verwijderRuimte(v, "r-leef")).toThrow(/laatste ruimte/);
  });
});

describe("sparingen", () => {
  const { project: tweeLagen, verdiepingId } = voegVerdiepingToe(appartement, { modus: "kopie", naam: "Verdieping" });
  const boven = tweeLagen.verdiepingen.find((v) => v.id === verdiepingId)!;
  const leefBoven = boven.ruimtes.find((r) => r.naam === "Leefruimte")!;
  const metGat = voegSparingToe(boven, { ruimteId: leefBoven.id, soort: "trapgat", x: 0, y: 0, breedte: 1000, lengte: 2800 });
  const p: Project = { ...tweeLagen, verdiepingen: tweeLagen.verdiepingen.map((v) => (v.id === verdiepingId ? metGat : v)) };

  it("trapgat: vloer boven en plafond onder worden kleiner", () => {
    expect(controleerSamenhang(p)).toEqual([]);
    const lb = lastenboek(p);
    const post = (ver: string, code: string) => lb.regels.find((r) => r.verdieping === ver && r.ruimte === "Leefruimte" && r.code === code)!.hoeveelheid;
    expect(post("Verdieping", "01")).toBe(23.3); // 26,10 − 2,80
    expect(post("Gelijkvloers", "04")).toBe(23.3); // plafond onder
    expect(post("Gelijkvloers", "01")).toBe(26.1); // vloer onder ongewijzigd
    expect(post("Verdieping", "04")).toBe(26.1); // plafond boven ongewijzigd
    expect(meetstaat(p).find((r) => r.verdieping === "Verdieping" && r.ruimte === "Leefruimte")!.vloerM2).toBe(23.3);
  });
  it("tekening toont de sparing, label netto", () => {
    const svg = verdiepingNaarSVG(metGat);
    expect(svg).toContain("trapgat");
    expect(svg).toContain("23,30 m²");
    expect(verdiepingNaarDXF(metGat)).toContain("SPARINGEN");
  });
  it("weigert buiten de ruimte of overlappend; verwijderen", () => {
    expect(() => voegSparingToe(boven, { ruimteId: leefBoven.id, soort: "trapgat", x: 5000, y: 0, breedte: 1000, lengte: 1000 })).toThrow(/buiten/);
    expect(() => voegSparingToe(metGat, { ruimteId: leefBoven.id, soort: "schacht", x: 500, y: 500, breedte: 300, lengte: 300 })).toThrow(/overlapt/);
    const twee = voegSparingToe(metGat, { ruimteId: leefBoven.id, soort: "schacht", x: 3000, y: 3000, breedte: 400, lengte: 400 });
    expect(new Set(twee.sparingen.map((s) => s.id)).size).toBe(2);
    expect(verwijderSparing(twee, twee.sparingen[0]!.id).sparingen).toHaveLength(1);
  });
  it("oude projectbestanden zonder sparingen blijven leesbaar", () => {
    const oud = JSON.parse(JSON.stringify(appartement));
    delete oud.verdiepingen[0].sparingen;
    expect(leesProject(oud).ok).toBe(true);
  });
});

describe("prijzen en raming", () => {
  const lb = lastenboek(appartement);
  const prijzen = { "01": 45, "03": 18.5, "06": 9 };

  it("rekent bedragen en btw", () => {
    const r = raming(lb, prijzen, 6);
    expect(r.regels.find((x) => x.code === "01")!.bedrag).toBe(1863); // 41,40 × 45
    expect(r.exclBtw).toBe(4254.4); // 1863 + 86,96 × 18,5 (1608,76) + 86,96 × 9 (782,64)
    expect(r.btw).toBe(Math.round(r.exclBtw * 6) / 100);
    expect(r.zonderPrijs).toContain("02");
  });
  it("euro-notatie en veilig inlezen", () => {
    expect(euro(4254.4)).toBe("€ 4.254,40");
    expect(leesPrijzen({ "01": 45, "x": 3, "02": -1, "03": "12", "04": 1e9 })).toEqual({ "01": 45 });
  });
  it("prijzen in CSV, klembord en PDF", async () => {
    const csv = lastenboekCSV(lb, "Test", prijzen, 21);
    expect(csv).toContain("01;Vloerafwerking;m²;41,40;45,00;=D2*E2");
    expect(csv).toMatch(/Btw 21 %;;;;=F12\*21\/100/);
    expect(csv).toMatch(/Totaal incl\. btw;;;;=F12\+F13/);
    expect(lastenboekTSV(lb, prijzen).split("\n")[0]).toBe("01\tVloerafwerking\tm²\t41,40\t45,00\t1863,00");
    const doc = await PDFDocument.load(await projectNaarPDF(appartement, { datum: "2026-11-24", prijzen, btwPct: 6 }));
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});

describe("hoekpunten (camera)", () => {
  // rechthoek 4000 × 3000, 12° gedraaid, met ruis tot 40 mm
  const draai = (p: { x: number; y: number }, g: number) => ({ x: p.x * Math.cos(g) - p.y * Math.sin(g), y: p.x * Math.sin(g) + p.y * Math.cos(g) });
  const ruis = [[12, -30], [-25, 18], [40, 5], [-8, -35]];
  const recht = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }]
    .map((p, i) => draai(p, 0.21)).map((p, i) => ({ x: p.x + ruis[i]![0]! + 1500, y: p.y + ruis[i]![1]! - 700 }));

  it("maakt een gedraaide, onnauwkeurige rechthoek haaks", () => {
    const h = haaksMaken(recht);
    expect(h.punten).toHaveLength(4);
    const xs = h.punten.map((p) => p.x), ys = h.punten.map((p) => p.y);
    expect(new Set(xs).size).toBe(2);
    expect(new Set(ys).size).toBe(2);
    expect(Math.abs(Math.max(...xs) - 4000)).toBeLessThan(60);
    expect(Math.abs(Math.max(...ys) - 3000)).toBeLessThan(60);
    expect(h.maxAfwijking).toBeLessThan(2);
  });

  it("L-vorm met 6 hoeken, dubbele tik genegeerd", () => {
    const l = [{ x: 0, y: 0 }, { x: 5000, y: 10 }, { x: 5010, y: 20 }, { x: 4990, y: 2000 }, { x: 2000, y: 2010 }, { x: 2010, y: 4000 }, { x: -10, y: 3990 }];
    const h = haaksMaken(l);
    expect(h.punten).toHaveLength(6);
  });

  it("weigert een echt schuine muur en te weinig punten", () => {
    expect(() => haaksMaken([{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 2000, y: 3000 }, { x: 0, y: 3000 }])).toThrow(/wijkt 34° af van haaks/);
    expect(() => haaksMaken([{ x: 0, y: 0 }, { x: 10, y: 0 }])).toThrow(/minstens 3/);
  });

  it("project uit hoekpunten: binnenmaten kloppen, muren rond", () => {
    const h = haaksMaken(recht);
    const p = projectUitHoekpunten(h.punten, { naam: "Scan", ruimteNaam: "Keuken", muurdikte: 200, plafondhoogte: 2600, nu: "2026-11-24T10:00:00Z" });
    expect(controleerSamenhang(p)).toEqual([]);
    const v = p.verdiepingen[0]!;
    const r = v.ruimtes[0]!;
    expect(oppervlakte(r.contour)).toBe(oppervlakte(h.punten));
    for (const m of v.muren) expect(binnenLengte(m, v.muren)).toBeGreaterThan(2900);
    expect(v.muren.every((m) => m.bron.methode === "gescand")).toBe(true);
    // de buitenmaat van een muur = binnen + 2 × 100
    const breedte = Math.max(...h.punten.map((q) => q.x));
    expect(v.muren.map((m) => Math.round(binnenLengte(m, v.muren))).sort((a, b) => a - b)).toContain(breedte);
  });
});
