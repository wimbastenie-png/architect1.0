import { describe, expect, it } from "vitest";
import { appartement } from "../examples/appartement.ts";
import {
  extraPosten, lastenboek, lastenboekCSV, leesPrijzen, nieuweLigger, raming, voegInstallatiepuntToe, voegNieuweMuurToe, zetMuurToestand, zetOpeningToestand,
  type Project,
} from "../src/index.ts";

function verbouwing(): Project {
  let v = appartement.verdiepingen[0]!;
  v = zetMuurToestand(v, "m-binnen", "afbreken");
  v = zetOpeningToestand(v, "o-raam-slaap", "dicht");
  v = { ...v, openingen: [...v.openingen, { id: "o-nieuw", muurId: "m-rechts", soort: "raam", offset: 1500, breedte: 1200, hoogte: 1400, borstwering: 900, bron: { methode: "manueel" }, toestand: "nieuw" }] };
  v = voegNieuweMuurToe(v, { x: 3010, y: 150 }, { x: 3010, y: 4650 }, 100).verdieping;
  v = voegInstallatiepuntToe(v, "verdeelbord", { x: 300, y: 300 }).verdieping;
  v = voegInstallatiepuntToe(v, "stopcontact", { x: 1000, y: 300 }).verdieping;
  v = voegInstallatiepuntToe(v, "watermeter", { x: 300, y: 4400 }).verdieping;
  v = voegInstallatiepuntToe(v, "wastafel", { x: 2000, y: 4400 }).verdieping;
  return { ...appartement, verdiepingen: [v] };
}

describe("lastenboek: afbraak, ruwbouw, installaties", () => {
  const p = verbouwing();
  const x = extraPosten(p);
  const h = (code: string) => x.find((y) => y.code === code)?.hoeveelheid;

  it("afbraak (handberekening)", () => {
    expect(h("A01")).toBe(11.2); // 4,8 × 2,7 − binnendeur 0,83 × 2,115
    expect(h("A02")).toBe(1.68); // nieuw raam 1,2 × 1,4
    expect(h("A03")).toBe(1.62); // 11,20455 × 0,1 + 1,68 × 0,3
    expect(h("A04")).toBe(2.27); // × 1,4
    expect(h("A05")).toBe(2.92); // × 1,8 t/m³
    expect(h("A06")).toBe(1);
    expect(h("A07")).toBe(9); // 4,8 m → 6 stutten; opening 1,6 m in dragende muur → 3
  });

  it("ruwbouw: metselwerk per dikte, latei, dichtmaken, chape", () => {
    expect(h("R01-100")).toBe(12.15); // 4,5 × 2,7
    expect(h("R02-1600")).toBe(1);
    expect(h("R04")).toBe(2.24); // 1,6 × 1,4
    expect(h("R05")).toBeGreaterThan(40);
  });

  it("ligger vervangt de latei en komt als post", () => {
    const l = { ...nieuweLigger("l1", 1200, 300), muurId: "m-rechts" };
    const q = { ...p, liggers: [l] };
    const y = extraPosten(q);
    expect(y.some((z) => z.code.startsWith("R02"))).toBe(false);
    const post = y.find((z) => z.code.startsWith("R03-"))!;
    expect(post.omschrijving).toMatch(/Stalen ligger (IPE|HEA|HEB) \d+ S235, L = 1600 mm/);
    expect(post.hoeveelheid).toBe(2);
  });

  it("installaties: vaste codes, mee in totalen, prijzen, CSV en raming", () => {
    const e = x.filter((y) => y.groep === "Elektriciteit");
    expect(e.length).toBeGreaterThan(2);
    expect(extraPosten(p).map((y) => y.code)).toEqual(x.map((y) => y.code)); // stabiel
    const lb = lastenboek(p);
    expect(lb.totalen.some((t) => t.code === "A01" && t.groep === "Afbraak")).toBe(true);
    const prijzen = leesPrijzen({ A01: 45, "R01-100": 60, [e[0]!.code]: 12.5, "slecht code!": 1 });
    expect(Object.keys(prijzen)).toHaveLength(3);
    const r = raming(lb, prijzen, 21);
    expect(r.regels.find((t) => t.code === "A01")!.bedrag).toBe(504);
    const csv = lastenboekCSV(lb, p.naam, prijzen, 21);
    expect(csv).toContain("A01;Afbreken muren;m²;11,20;45,00;");
    expect(csv).toContain("vakman controleert en tekent af");
    expect(csv).toContain("Afbraak: muuroppervlak");
  });

  it("geen ontwerp en geen installaties: geen extra posten", () => {
    expect(extraPosten(appartement)).toEqual([]);
  });
});

describe("elke PDF: de app bereidt voor, een vakman controleert", () => {
  it("plan, installaties, ontwerp en rekennota: op elk blad", async () => {
    const m = await import("../src/index.ts");
    const { execFileSync } = await import("node:child_process");
    const { writeFileSync, mkdtempSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const p = { ...verbouwing(), liggers: [nieuweLigger("l1", 1200, 300)] };
    const pdfs = {
      plan: await m.projectNaarPDF(p, { datum: "2026-11-27", prijzen: { A01: 45 } }),
      installaties: await m.installatiesNaarPDF(p, { datum: "2026-11-27" }),
      ontwerp: await m.ontwerpNaarPDF(p, { datum: "2026-11-27" }),
      rekennota: await m.rekennotaNaarPDF(p, p.liggers, { datum: "2026-11-27" }),
    };
    const map = mkdtempSync(join(tmpdir(), "vakman-"));
    for (const [naam, bytes] of Object.entries(pdfs)) {
      const pad = join(map, `${naam}.pdf`);
      writeFileSync(pad, bytes);
      let tekst = "";
      try { tekst = execFileSync("pdftotext", [pad, "-"], { encoding: "utf8" }); } catch { return; }
      const bladen = tekst.split("\f").filter((b) => b.trim());
      expect(bladen.length, naam).toBeGreaterThan(0);
      for (const b of bladen) expect(b.replace(/\s+/g, " "), `${naam}`).toMatch(/vakman controleert en tekent af|controleren, aan te vullen en af te tekenen door een ingenieur/);
      if (naam === "plan") expect(tekst).toContain("Afbreken muren");
    }
  });
});
