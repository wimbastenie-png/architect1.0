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
  haakseVereniging,
  maatketens,
  muurLengte,
  sparingMaten,
  verschuifMuur,
  verschuifRichtingen,
  wijzigSparing,
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
  it("weigert buitenmuren", () => {
    expect(() => breekMuurUit(v0, "m-links")).toThrow(/tussen twee ruimtes/);
  });
  it("gevel is na het uitbreken terug één muur (geen spookmaat in de ketting)", () => {
    const v = breekMuurUit(v0, "m-binnen");
    expect(v.muren).toHaveLength(4);
    const onder = v.muren.find((m) => m.start.y === 0 && m.eind.y === 0)!;
    expect(muurLengte(onder)).toBe(9600);
    // raam van de slaapkamer staat op dezelfde plaats (x = 6000 + 900)
    const raam = v.openingen.find((o) => o.id === "o-raam-slaap")!;
    expect(raam.muurId).toBe(onder.id);
    expect(onder.start.x + raam.offset).toBe(6900);
    const gevel = maatketens(v).filter((k) => k.rij === 1 && k.a.y === k.b.y && k.a.y < 0);
    expect(gevel.map((k) => Math.round(k.lengte))).toEqual([9900]);
    expect(maatketens(v).some((k) => k.rij === 2 && k.a.y < 0)).toBe(false);
    expect(controleerSamenhang(metV(v))).toEqual([]);
  });
  it("ongelijke ruimtes worden een L-vormige ruimte", () => {
    const v1 = voegRuimteToe(v0, { muurId: "m-rechts", naam: "Berging", breedte: 2000, diepte: 1500, afstandVanafA: 1000, muurdikte: 200, plafondhoogte: 2400 });
    const tussen = v1.ruimtes.find((r) => r.naam === "Berging")!.muurIds.find((id) => v1.ruimtes.filter((r) => r.muurIds.includes(id)).length === 2)!;
    const v = breekMuurUit(v1, tussen);
    expect(v.ruimtes).toHaveLength(2);
    const l = v.ruimtes.find((r) => r.naam === "Slaapkamer + Berging")!;
    expect(l.contour).toHaveLength(8);
    // 3400 × 4500 + 1500 × 2000 + brug over de gevel 300 × 2000
    expect(oppervlakte(l.contour)).toBe(3400 * 4500 + 1500 * 2000 + 300 * 2000);
    expect(l.plafondhoogte).toBe(2400);
    expect(controleerSamenhang(metV(v))).toEqual([]);
    expect(meetstaat(metV(v)).find((r) => r.ruimte === "Slaapkamer + Berging")!.vloerM2).toBe(18.9);
  });
  it("vereniging weigert losse stukken", () => {
    const r = (x: number) => [{ x, y: 0 }, { x: x + 10, y: 0 }, { x: x + 10, y: 10 }, { x, y: 10 }];
    expect(() => haakseVereniging([r(0), r(20)])).toThrow(/losse stukken/);
    expect(haakseVereniging([r(0), r(10)])).toHaveLength(4);
  });
});

describe("ruimte verwijderen", () => {
  it("verwijdert eigen muren, houdt gedeelde muren", () => {
    const v1 = voegRuimteToe(v0, { muurId: "m-rechts", naam: "Berging", breedte: 2000, diepte: 1500, afstandVanafA: 1000, plafondhoogte: 2400 });
    const berging = v1.ruimtes.find((r) => r.naam === "Berging")!;
    const v = verwijderRuimte(v1, berging.id);
    expect(v.ruimtes).toHaveLength(2);
    // 3 eigen muren weg, en de gesplitste gevel (3 stukken) is terug één muur
    expect(v.muren.length).toBe(v0.muren.length);
    expect(muurLengte(v.muren.find((m) => m.id === "m-rechts")!)).toBe(4800);
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

describe("muur verschuiven", () => {
  it("tussenmuur 200 mm naar rechts: ruimtes passen zich aan, raam blijft staan", () => {
    const m = v0.muren.find((x) => x.id === "m-binnen")!;
    const rechts = verschuifRichtingen(m).find((r) => r.label === "naar rechts")!;
    const v = verschuifMuur(v0, "m-binnen", 200 * rechts.teken);
    expect(oppervlakte(v.ruimtes.find((r) => r.id === "r-leef")!.contour)).toBe(6000 * 4500);
    expect(oppervlakte(v.ruimtes.find((r) => r.id === "r-slaap")!.contour)).toBe(3200 * 4500);
    const onderRechts = v.muren.find((x) => x.id === "m-onder-rechts")!;
    const raam = v.openingen.find((o) => o.id === "o-raam-slaap")!;
    expect(onderRechts.start.x + raam.offset).toBe(6900);
    expect(controleerSamenhang(metV(v))).toEqual([]);
    expect(v.muren.find((x) => x.id === "m-binnen")!.bron.methode).toBe("gecorrigeerd");
  });
  it("buitenmuur 100 mm naar links: ramen in de aansluitende gevel blijven op hun plaats", () => {
    const m = v0.muren.find((x) => x.id === "m-links")!;
    const links = verschuifRichtingen(m).find((r) => r.label === "naar links")!;
    const v = verschuifMuur(v0, "m-links", 100 * links.teken, "laser");
    expect(oppervlakte(v.ruimtes.find((r) => r.id === "r-leef")!.contour)).toBe(5900 * 4500);
    const onderLinks = v.muren.find((x) => x.id === "m-onder-links")!;
    expect(onderLinks.start.x).toBe(-100);
    expect(onderLinks.start.x + v.openingen.find((o) => o.id === "o-raam-leef")!.offset).toBe(1500);
    expect(v.openingen.find((o) => o.id === "o-voordeur")!.offset).toBe(1000); // in de verschoven muur zelf
    expect(controleerSamenhang(metV(v))).toEqual([]);
  });
  it("weigert te ver, en muren die recht doorlopen", () => {
    expect(() => verschuifMuur(v0, "m-binnen", -3500)).toThrow(/te kort|door ruimte|past niet/);
    const v1 = voegRuimteToe(v0, { muurId: "m-rechts", naam: "Berging", breedte: 2000, diepte: 1500, afstandVanafA: 1000, plafondhoogte: 2400 });
    const stuk = v1.muren.find((x) => x.id === "m-rechts")!;
    expect(() => verschuifMuur(v1, stuk.id, 100)).toThrow(/recht door/);
  });
});

describe("sparing wijzigen", () => {
  const leef = v0.ruimtes.find((r) => r.id === "r-leef")!;
  const met = voegSparingToe(v0, { ruimteId: "r-leef", soort: "trapgat", x: 0, y: 0, breedte: 1000, lengte: 2800 });
  const id = met.sparingen[0]!.id;
  it("verplaatsen en vergroten, id blijft", () => {
    const v = wijzigSparing(met, id, { soort: "trapgat", x: 500, y: 200, breedte: 1100, lengte: 3000 });
    const s = v.sparingen.find((x) => x.id === id)!;
    expect(sparingMaten(s, leef)).toEqual({ x: 500, y: 200, breedte: 1100, lengte: 3000 });
    expect(v.sparingen).toHaveLength(1);
  });
  it("weigert buiten de ruimte en laat het origineel ongemoeid", () => {
    expect(() => wijzigSparing(met, id, { soort: "trapgat", x: 5000, y: 0, breedte: 1000, lengte: 1000 })).toThrow(/buiten/);
    expect(met.sparingen[0]!.contour[0]).toEqual({ x: 150, y: 150 });
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

describe("meldingen", () => {
  it("juist lidwoord: het trapgat, de vide", () => {
    const v0b = appartement.verdiepingen[0]!;
    expect(() => voegSparingToe(v0b, { ruimteId: "r-leef", soort: "trapgat", x: 9000, y: 0, breedte: 100, lengte: 100 })).toThrow(/^Het trapgat valt/);
    expect(() => voegSparingToe(v0b, { ruimteId: "r-leef", soort: "vide", x: 9000, y: 0, breedte: 100, lengte: 100 })).toThrow(/^De vide valt/);
  });
});
