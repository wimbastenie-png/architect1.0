import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { appartement } from "../examples/appartement.ts";
import {
  bewaarDag, dagboekNaarPDF, dagboekTotalen, dagVan, leesProject, meerwerkNaarPDF, meerwerkRegels, meerwerkTotalen, nieuweVordering, nieuwMeerwerk,
  vorderingsstaat, zetMeerwerkStatus, type Project,
} from "../src/index.ts";

const prijzen = { "01": 50 };
const firma = { naam: "Bouwbedrijf Voorbeeld bv" };
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));

describe("meer- en minwerken", () => {
  it("voorstel → akkoord → in de vorderingsstaat; minwerk negatief", () => {
    let r = nieuwMeerwerk(appartement, { omschrijving: "Extra stopcontact keuken", soort: "meer", eenheid: "st", hoeveelheid: 2, prijs: 85 }, "2026-12-02");
    let p = r.project; const meer = r.id;
    r = nieuwMeerwerk(p, { omschrijving: "Geen plint slaapkamer", soort: "min", eenheid: "m", hoeveelheid: 10, prijs: 6.5 });
    p = r.project; const min = r.id;
    expect(p.meerwerken.map((m) => m.nr)).toEqual([1, 2]);
    expect(meerwerkRegels(p)).toHaveLength(0); // nog geen akkoord
    expect(meerwerkTotalen(p).voorgesteld).toBeCloseTo(170 - 65, 2);
    expect(() => zetMeerwerkStatus(p, meer, "akkoord")).toThrow(/naam/);
    p = zetMeerwerkStatus(p, meer, "akkoord", { door: "Mevr. Peeters", datum: "2026-12-03" });
    p = zetMeerwerkStatus(p, min, "akkoord", { door: "Mevr. Peeters" });
    const t = meerwerkTotalen(p);
    expect([t.meer, t.min, t.saldo, t.open]).toEqual([170, -65, 105, 0]);
    p = nieuweVordering(p, "2026-12-15");
    p = { ...p, vorderingen: p.vorderingen.map((v) => ({ ...v, procent: { "01": 50, MW1: 100, MW2: 100 } })) };
    const s = vorderingsstaat(p, prijzen, 1);
    expect(s.regels.find((x) => x.code === "MW1")!.dezeStaat).toBe(170);
    expect(s.regels.find((x) => x.code === "MW2")!.dezeStaat).toBe(-65);
    expect(s.dezeStaat).toBeCloseTo(41.4 * 50 / 2 + 105, 2);
    // na afsluiten: akkoord niet meer terug te draaien
    p = nieuweVordering(p, "2027-01-15");
    expect(() => zetMeerwerkStatus(p, meer, "geweigerd")).toThrow(/afgesloten vorderingsstaat/);
    expect(leesProject(JSON.parse(JSON.stringify(p))).ok).toBe(true);
  });

  it("geweigerd telt niet mee; lege omschrijving wordt geweigerd", () => {
    const r = nieuwMeerwerk(appartement, { omschrijving: "Dakraam", soort: "meer", eenheid: "st", hoeveelheid: 1, prijs: 900 });
    const p = zetMeerwerkStatus(r.project, r.id, "geweigerd", { reden: "te duur" });
    expect(meerwerkRegels(p)).toHaveLength(0);
    expect(p.meerwerken[0]!.reden).toBe("te duur");
    expect(() => nieuwMeerwerk(appartement, { omschrijving: " ", soort: "meer", eenheid: "st", hoeveelheid: 1, prijs: 1 })).toThrow();
  });

  it("bon (PDF) met handtekeningvakken", async () => {
    const r = nieuwMeerwerk(appartement, { omschrijving: "Extra stopcontact", soort: "meer", eenheid: "st", hoeveelheid: 2, prijs: 85 });
    const pdf = await meerwerkNaarPDF(r.project, firma, r.id, 6);
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(1);
  });
});

describe("werfdagboek", () => {
  it("dag bewaren, bijwerken, totalen en PDF met foto", async () => {
    let p: Project = appartement;
    p = { ...p, fotos: [...p.fotos, { id: "f1", datum: "2026-12-02T08:00:00Z", soort: "werf" }] };
    p = bewaarDag(p, { ...dagVan(p, "2026-12-03"), weer: "regen", ploeg: "Jan, Piet", uren: 16, werk: "Afbraak keuken", fotoIds: [] });
    p = bewaarDag(p, { ...dagVan(p, "2026-12-02"), weer: "zon", temperatuur: 8, uren: 8, werk: "Werf ingericht", fotoIds: ["f1"] });
    p = bewaarDag(p, { ...dagVan(p, "2026-12-04"), verlet: true, werk: "", problemen: "Vorst", fotoIds: [] });
    expect(p.dagboek.map((d) => d.datum)).toEqual(["2026-12-02", "2026-12-03", "2026-12-04"]);
    p = bewaarDag(p, { ...dagVan(p, "2026-12-03"), uren: 14 }); // bijwerken, geen dubbel
    expect(p.dagboek).toHaveLength(3);
    expect(dagboekTotalen(p)).toEqual({ dagen: 3, werkdagen: 2, verlet: 1, uren: 22 });
    expect(dagboekTotalen(p, "2026-12-03").dagen).toBe(2);
    const pdf = await dagboekNaarPDF(p, firma, { fotos: { f1: PNG } });
    expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThanOrEqual(1);
    expect(leesProject(JSON.parse(JSON.stringify(p))).ok).toBe(true);
  });
});
