import { describe, expect, it } from "vitest";
import { appartement } from "../examples/appartement.ts";
import {
  aandachtspunten, eendraadschemaSVG, GAS_WAARSCHUWING, kringenVoorstel, leesProject, leidingen, materiaallijst,
  verdiepingNaarSVG, voegInstallatiepuntToe, wijzigInstallatiepunt, type Project, type Verdieping,
} from "../src/index.ts";

/** Appartement: leefruimte x 150..5950, slaapkamer (hier: badkamer) x 6050..9450, y 150..4650. */
function metInstallaties(): Project {
  let v: Verdieping = { ...appartement.verdiepingen[0]!, ruimtes: appartement.verdiepingen[0]!.ruimtes.map((r) => (r.naam === "Slaapkamer" ? { ...r, naam: "Badkamer" } : r)) };
  const zet = (soort: string, x: number, y: number) => { v = voegInstallatiepuntToe(v, soort, { x, y }).verdieping; };
  zet("verdeelbord", 300, 300);
  for (let i = 0; i < 10; i++) zet("stopcontact", 400 + i * 500, 200);
  zet("lichtpunt", 2000, 2000); zet("lichtpunt", 4000, 2000); zet("schakelaar", 600, 4500);
  zet("lichtpunt", 7500, 2400); // badkamer zonder schakelaar
  zet("douche", 9000, 4200); zet("stopcontact", 8800, 3800); // te dicht bij de douche
  zet("kookplaat", 5000, 4400);
  zet("watermeter", 300, 4400); zet("boiler", 6300, 400); zet("afvoer", 9300, 300);
  zet("wastafel", 7000, 4500); zet("wc", 1000, 4400); // wc ver van de afvoer
  zet("gasmeter", 300, 2500); zet("gasketel", 6300, 1200);
  return { ...appartement, verdiepingen: [v] };
}

describe("installaties", () => {
  const p = metInstallaties();

  it("project met installaties blijft geldig en reist mee", () => {
    const r = leesProject(JSON.parse(JSON.stringify(p)));
    expect(r.ok).toBe(true);
    expect(r.ok && r.project.verdiepingen[0]!.installaties).toHaveLength(p.verdiepingen[0]!.installaties.length);
    // oud bestand zonder installaties: lege lijst
    const oud = JSON.parse(JSON.stringify(appartement));
    delete oud.verdiepingen[0].installaties;
    const o = leesProject(oud);
    expect(o.ok && o.project.verdiepingen[0]!.installaties).toEqual([]);
  });

  it("kringen: max. 8 stopcontacten, natte ruimte op 30 mA, kookplaat apart 32 A / 6 mm²", () => {
    const k = kringenVoorstel(p);
    const stop = k.filter((x) => x.soort === "stopcontacten");
    expect(stop.map((x) => x.punten.length).sort()).toEqual([1, 2, 8].sort()); // 10 → 8 + 2, badkamer apart
    const nat = stop.find((x) => x.omschrijving.includes("natte"))!;
    expect(nat.differentieel).toBe(30);
    const kp = k.find((x) => x.omschrijving.startsWith("Elektrische kookplaat"))!;
    expect([kp.automaat, kp.kabel]).toEqual([32, 6]);
    expect(k.find((x) => x.soort === "verlichting")!.kabel).toBe(1.5);
    // 300 mA-kringen eerst, dan de 30 mA-groep
    const idx = k.findIndex((x) => x.differentieel === 30);
    expect(k.slice(idx).every((x) => x.differentieel === 30)).toBe(true);
    expect(new Set(k.map((x) => x.code)).size).toBe(k.length);
    for (const x of k) expect(x.kabelLengte).toBeGreaterThan(0);
  });

  it("vaste kring en te veel stopcontacten: aandachtspunt", () => {
    let v = p.verdiepingen[0]!;
    for (const x of v.installaties.filter((y) => y.soort === "stopcontact")) v = wijzigInstallatiepunt(v, x.id, { kring: "K9" });
    const a = aandachtspunten({ ...p, verdiepingen: [v] });
    expect(a.some((x) => x.tekst.includes("Kring K9: 11 stopcontacten"))).toBe(true);
  });

  it("aandachtspunten: douche, schakelaar, afvoer, gas — nooit 'conform'", () => {
    const a = aandachtspunten(p);
    const t = a.map((x) => x.tekst).join("\n");
    expect(t).toContain("van de douche");
    expect(t).toContain("Badkamer (Gelijkvloers): lichtpunt zonder schakelaar");
    expect(t).toMatch(/Afvoer Wc in Leefruimte: .* cm hoogteverschil/);
    expect(t).toContain(GAS_WAARSCHUWING);
    expect(t.toLowerCase()).toContain("gekeurd");
    expect(t.toLowerCase()).not.toMatch(/\bis conform\b|\bconform\.|goedgekeurd/);
  });

  it("leidingen: haaks, diameters en helling", () => {
    const ld = leidingen(p);
    const wc = ld.find((l) => l.soort === "afvoer" && l.diameter === 110)!;
    expect(wc.helling).toBe(2);
    expect(wc.hoogteverschil).toBe(Math.round(wc.lengte * 0.02));
    for (const l of ld) for (let i = 1; i < l.pad.length; i++) expect(l.pad[i]!.x === l.pad[i - 1]!.x || l.pad[i]!.y === l.pad[i - 1]!.y).toBe(true);
    expect(ld.filter((l) => l.soort === "warm").length).toBe(2); // wastafel + douche
    expect(ld.filter((l) => l.soort === "gas").length).toBe(1);
  });

  it("materiaallijst en tekeningen", () => {
    const m = materiaallijst(p);
    expect(m.find((x) => x.omschrijving === "Stopcontact")!.hoeveelheid).toBe(11);
    expect(m.some((x) => x.omschrijving.startsWith("Kabel 3G2,5"))).toBe(true);
    expect(m.some((x) => x.omschrijving.startsWith("Gasafsluitkraan"))).toBe(true);
    const svg = verdiepingNaarSVG(p.verdiepingen[0]!, { interactief: true, installaties: { project: p } });
    expect((svg.match(/data-installatie=/g) ?? []).length).toBe(p.verdiepingen[0]!.installaties.length);
    const schema = eendraadschemaSVG(p);
    expect(schema).toContain("Diff. 30 mA");
    expect(schema).toContain("C 32 A");
  });
});

describe("installaties-PDF", () => {
  it("planbladen per net, schema en lijsten; gaswaarschuwing op elk blad", async () => {
    const { installatiesNaarPDF, projectNaarPDF } = await import("../src/index.ts");
    const { PDFDocument } = await import("pdf-lib");
    const p = metInstallaties();
    const bytes = await installatiesNaarPDF(p, { datum: "2026-11-26" });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(5); // 3 netten + schema + lijsten
    const { execFileSync } = await import("node:child_process");
    const { writeFileSync, mkdtempSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const pad = join(mkdtempSync(join(tmpdir(), "inst-")), "i.pdf");
    writeFileSync(pad, bytes);
    let tekst = "";
    try { tekst = execFileSync("pdftotext", ["-layout", pad, "-"], { encoding: "utf8" }); } catch { return; } // pdftotext niet aanwezig
    const bladen = tekst.split("\f").filter((b) => b.trim());
    for (const b of bladen) expect(b).toContain("GAS:");
    expect(tekst).toContain("Eendraadschema");
    expect(tekst).toContain("Materiaallijst");
    // ook het gewone plan krijgt de gaswaarschuwing
    writeFileSync(pad, await projectNaarPDF(p, { datum: "2026-11-26" }));
    expect(execFileSync("pdftotext", [pad, "-"], { encoding: "utf8" })).toContain("GAS:");
  });
});
