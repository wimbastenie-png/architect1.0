import { describe, expect, it } from "vitest";
import { appartement } from "../examples/appartement.ts";
import {
  aanzicht, afstandenTotGrenzen, controleerTrap, dakOnder, dakVlakken, deelRuimtesIn, doorsnede, inplantingsplan, leesProject, m2, meetstaat, model3D, nokHoogte,
  oppervlakte, perceelRechthoek, trapVoorstel, verdiepingInToestand, verdiepingNaarSVG, vergunningNaarPDF, voegNieuweMuurToe, voegVerdiepingToe, zetMuurToestand, type Project,
} from "../src/index.ts";

const t35 = Math.tan((35 * Math.PI) / 180);
const zadel: Project = { ...appartement, dak: { soort: "zadel", helling: 35, nok: "x", overstek: 300, dikte: 300, materiaal: "pannen" } };

describe("architect: dak", () => {
  it("zadeldak: nokhoogte en goot (handberekening)", () => {
    // voet: buitenkant muren y −150 … 4950 → halve breedte 2550; muurplaat 2700
    expect(nokHoogte(zadel)).toBeCloseTo(2700 + 2550 * t35 + 300 / Math.cos((35 * Math.PI) / 180), 0);
    expect(dakOnder(zadel, 3000, -450)).toBeCloseTo(2700 - 300 * t35, 0); // overstek: lager dan de muurplaat
    expect(dakOnder(zadel, 3000, -1000)).toBeNull();
    expect(dakVlakken(zadel)).toHaveLength(4); // 2 dakvlakken + 2 topgevels
    expect(model3D(zadel).vlakken.length).toBe(4);
  });

  it("doorsnede loodrecht op de nok: dakband tot de nok; gevel: topgevel en dakband", () => {
    const d = doorsnede(zadel, { x: 3000, y: -1000 }, { x: 3000, y: 6000 });
    const band = d.elementen.find((e) => e.t === "veelhoek")!;
    expect(band.t === "veelhoek" && Math.max(...band.punten.map((q) => q.y))).toBeCloseTo(nokHoogte(zadel)!, -1);
    const links = aanzicht(zadel, "links");
    const vh = links.elementen.filter((e) => e.t === "veelhoek");
    expect(vh.length).toBe(2); // topgevel + dak
    expect(links.elementen.some((e) => e.t === "tekst" && e.s === "Dak: pannen")).toBe(true);
    const voor = aanzicht(zadel, "voor");
    expect(voor.elementen.filter((e) => e.t === "veelhoek")).toHaveLength(1); // geen topgevel, wel het dakvlak
  });

  it("lessenaarsdak en plat dak", () => {
    const l: Project = { ...appartement, dak: { soort: "lessenaar", helling: 10, nok: "x", overstek: 0, dikte: 250 } };
    expect(dakOnder(l, 0, 4950)! - dakOnder(l, 0, -150)!).toBeCloseTo(5100 * Math.tan((10 * Math.PI) / 180), 0);
    const p: Project = { ...appartement, dak: { soort: "plat", helling: 0, nok: "x", overstek: 0, dikte: 400 } };
    expect(nokHoogte(p)).toBe(3100);
    expect(model3D(p).prismas.some((x) => x.naam === "plat dak")).toBe(true);
  });
});

describe("architect: trap, terrein, herindeling, PDF", () => {
  it("trapvoorstel volgens de comfortregel; geen trapgat → aandachtspunt", () => {
    const t = trapVoorstel(2850, { x: 1000, y: 1000 }, 0, 900);
    expect([t.treden, t.optrede, t.aantrede]).toEqual([16, 178, 274]);
    const p = voegVerdiepingToe({ ...appartement, verdiepingen: [{ ...appartement.verdiepingen[0]!, trappen: [t] }] }, { modus: "kopie", naam: "Verdieping", peil: 2850 }).project;
    const v = p.verdiepingen.find((x) => x.peil === 0)!;
    const o = controleerTrap(p, v, v.trappen[0]!).map((x) => x.tekst).join("\n");
    expect(o).toContain("2 × 178 + 274 = 630");
    expect(o).toContain("Geen trapgat");
    expect(verdiepingNaarSVG(v, { interactief: true })).toContain("16 × 178/274");
    const d = doorsnede(p, { x: 0, y: 1000 }, { x: 9600, y: 1000 });
    expect(d.elementen.some((e) => e.t === "veelhoek" && e.vul === "#d6d3d1")).toBe(true);
  });

  it("perceel en afstanden tot de grenzen; inplantingsplan", () => {
    const p: Project = { ...appartement, terrein: { perceel: perceelRechthoek(appartement, 15000, 30000, 6000, 2000), maaiveld: -150, straat: "Voorbeeldstraat" } };
    expect(afstandenTotGrenzen(p)).toEqual([6000, 3100, 18900, 2000]);
    expect(inplantingsplan(p).elementen.some((e) => e.t === "tekst" && e.s.includes("tot gebouw 6,00 m"))).toBe(true);
    expect(leesProject(JSON.parse(JSON.stringify(p))).ok).toBe(true);
    expect(doorsnede(p, { x: -500, y: 2400 }, { x: 10100, y: 2400 }).elementen.some((e) => e.t === "tekst" && e.s === "maaiveld −0,15")).toBe(true);
  });

  it("nieuwe indeling: afbreken voegt samen, nieuwe muur splitst; meetstaat nieuwe toestand", () => {
    let v = zetMuurToestand(appartement.verdiepingen[0]!, "m-binnen", "afbreken");
    v = voegNieuweMuurToe(v, { x: 3010, y: 150 }, { x: 3010, y: 4650 }, 100).verdieping;
    const r = deelRuimtesIn(v);
    const nieuw = verdiepingInToestand(r.verdieping, "nieuw");
    expect(nieuw.ruimtes).toHaveLength(2);
    const opp = nieuw.ruimtes.map((x) => m2(oppervlakte(x.contour))).sort((a, b) => a - b);
    expect(opp[0]).toBeCloseTo(2.81 * 4.5, 1); // links van de nieuwe muur
    expect(opp[1]).toBeCloseTo(6.39 * 4.5, 1); // rechts, samen met de vroegere slaapkamer
    expect(r.meldingen.join(" ")).toContain("worden één ruimte");
    expect(verdiepingInToestand(r.verdieping, "bestaand").ruimtes).toHaveLength(2); // bestaande toestand ongewijzigd
    const ms = meetstaat({ ...appartement, verdiepingen: [nieuw] });
    expect(ms.length).toBe(2);
  });

  it("vergunnings-PDF", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const p: Project = { ...zadel, terrein: { perceel: perceelRechthoek(appartement, 15000, 30000, 6000, 2000), maaiveld: -150 }, vergunning: { bouwheer: "Familie Peeters", kadaster: "Gent 5e afd., sectie B, 123a" }, gevelmaterialen: { voor: "gevelsteen rood-bruin" } };
    const doc = await PDFDocument.load(await vergunningNaarPDF(p, { datum: "2026-11-27" }));
    expect(doc.getPageCount()).toBe(1 + 2 + 4 + 1); // inplanting, bestaand + nieuw, 4 gevels, lijsten
  });
});
