import { describe, expect, it } from "vitest";
import { appartement } from "../examples/appartement.ts";
import {
  aanzicht, doorsnede, leesProject, maakHaaks, ontwerpNaarPDF, ontwerpWaarschuwingen, tekeningNaarSVG, vangPunt, verdiepingInToestand,
  verdiepingNaarSVG, verwijderNieuweMuur, voegNieuweMuurToe, voegVerdiepingToe, zetMuurToestand, zetOpeningToestand, type Project,
} from "../src/index.ts";

function verbouwing(): Project {
  let v = appartement.verdiepingen[0]!;
  v = zetMuurToestand(v, "m-binnen", "afbreken");
  v = zetOpeningToestand(v, "o-raam-slaap", "dicht");
  v = { ...v, openingen: [...v.openingen, { id: "o-nieuw", muurId: "m-rechts", soort: "raam", offset: 1500, breedte: 1200, hoogte: 1400, borstwering: 900, bron: { methode: "manueel" }, toestand: "nieuw" }] };
  // nieuwe binnenmuur van onder naar boven op x = 3000, gevangen op de binnenvlakken
  const a = vangPunt(v, { x: 3010, y: 230 }), b = vangPunt(v, maakHaaks(a, { x: 3040, y: 4600 }));
  v = voegNieuweMuurToe(v, a, b, 100).verdieping;
  return { ...appartement, verdiepingen: [v], doorsneden: [{ id: "d1", naam: "A-A", a: { x: -500, y: 2400 }, b: { x: 10100, y: 2400 } }] };
}

describe("ontwerp", () => {
  const p = verbouwing();
  const v = p.verdiepingen[0]!;

  it("project met ontwerp blijft geldig; nieuwe muur gevangen op de binnenvlakken", () => {
    expect(leesProject(JSON.parse(JSON.stringify(p))).ok).toBe(true);
    const n = v.muren.find((m) => m.toestand === "nieuw")!;
    expect(n.start).toEqual({ x: 3010, y: 150 });
    expect(n.eind).toEqual({ x: 3010, y: 4650 });
    expect(() => verwijderNieuweMuur(v, "m-links")).toThrow(/afbreken/);
    expect(verwijderNieuweMuur(v, n.id).muren).toHaveLength(7);
  });

  it("bestaande en nieuwe toestand", () => {
    const oud = verdiepingInToestand(v, "bestaand"), nieuw = verdiepingInToestand(v, "nieuw");
    expect(oud.muren.map((m) => m.id)).toContain("m-binnen");
    expect(oud.muren.some((m) => m.toestand === "nieuw")).toBe(false);
    expect(oud.openingen.map((o) => o.id)).not.toContain("o-nieuw");
    expect(nieuw.muren.map((m) => m.id)).not.toContain("m-binnen");
    expect(nieuw.openingen.map((o) => o.id)).not.toContain("o-binnendeur"); // muur weg
    expect(nieuw.openingen.map((o) => o.id)).not.toContain("o-raam-slaap"); // dichtgemaakt
    expect(nieuw.openingen.map((o) => o.id)).toContain("o-nieuw");
  });

  it("waarschuwingen: afbreken en nieuwe opening in (mogelijk) dragende muur", () => {
    const w = ontwerpWaarschuwingen(p).map((x) => x.tekst).join("\n");
    expect(w).toContain("muur m-binnen");
    expect(w).toContain("Stabiliteitsstudie door een ingenieur");
    expect(w).toContain("Nieuwe opening van 1200 mm in muur m-rechts");
    expect(w).toContain("vergunningsplichtig");
  });

  it("plan in kleur: afbreken geel, nieuw rood", () => {
    const svg = verdiepingNaarSVG(v);
    expect(svg).toContain('fill="#facc15"');
    expect(svg).toContain('fill="#dc2626"');
  });

  it("doorsnede A-A: buitenmuren, nieuwe en af te breken muur gesneden, ruimtes met hoogte", () => {
    const d = doorsnede(p, p.doorsneden[0]!.a, p.doorsneden[0]!.b, { naam: "A-A" });
    const muren = d.elementen.filter((e) => e.t === "rect" && (e.vul === "#292524" || e.vul === "#facc15" || e.vul === "#dc2626"));
    expect(muren.length).toBe(5); // links, nieuw, binnen (afbreken), rechts in 2 stukken (nieuw raam op de snede)
    expect(d.elementen.some((e) => e.t === "rect" && e.vul === "#e0f2fe" && e.lijn === "#dc2626")).toBe(true);
    expect(d.elementen.some((e) => e.t === "tekst" && e.s === "Leefruimte")).toBe(true);
    expect(d.elementen.some((e) => e.t === "tekst" && e.s === "h 2700")).toBe(true);
    // twee verdiepingen: vloerplaat tussen plafond en volgend peil
    const twee = voegVerdiepingToe(p, { modus: "kopie", naam: "Verdieping" }).project;
    const d2 = doorsnede(twee, { x: -500, y: 2400 }, { x: 10100, y: 2400 });
    expect(d2.elementen.some((e) => e.t === "rect" && e.vul === "#a8a29e")).toBe(true);
    expect(tekeningNaarSVG(d2)).toContain("<svg");
  });

  it("voorgevel: twee ramen, rechtergevel: nieuw raam; dichtgemaakt raam weg in nieuwe toestand", () => {
    const voor = aanzicht(p, "voor", { toestand: "bestaand" });
    expect(voor.elementen.filter((e) => e.t === "rect" && e.vul === "#e0f2fe")).toHaveLength(2);
    const voorNieuw = aanzicht(p, "voor", { toestand: "nieuw" });
    expect(voorNieuw.elementen.filter((e) => e.t === "rect" && e.vul === "#e0f2fe")).toHaveLength(1);
    const rechts = aanzicht(p, "rechts", { toestand: "verbouwing" });
    expect(rechts.elementen.some((e) => e.t === "rect" && e.vul === "#e0f2fe" && e.lijn === "#dc2626")).toBe(true);
    const links = aanzicht(p, "links");
    expect(links.elementen.filter((e) => e.t === "rect" && e.vul === "#fff")).toHaveLength(1); // voordeur
  });

  it("PDF: verbouwing + nieuwe toestand per verdieping, doorsnede, 4 gevels, aandachtspunten", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(await ontwerpNaarPDF(p, { datum: "2026-11-26" }));
    expect(doc.getPageCount()).toBe(2 + 1 + 4 + 1);
  });
});
