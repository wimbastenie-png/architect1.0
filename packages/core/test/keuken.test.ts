import { describe, expect, it } from "vitest";
import { appartement } from "../examples/appartement.ts";
import {
  beschikbaar, controleerKeuken, kastenlijstCSV, keukenNaarPDF, leesProject, snijlijst, voegInstallatiepuntToe, vulWand, wandAanzicht, wandAanzichtDXF,
  wandenVan, wandObjecten, werkblad, type Maatwerk, type Project,
} from "../src/index.ts";

const v = appartement.verdiepingen[0]!;
const leef = v.ruimtes.find((r) => r.naam === "Leefruimte")!;
const wanden = wandenVan(v, leef);
const achter = wanden.find((w) => w.a.y === 4650 && w.b.y === 4650)!; // achtergevel, zonder openingen
const voor = wanden.find((w) => w.a.y === 150 && w.b.y === 150)!; // met raam R1

function wand(rand: number, meting: Partial<Maatwerk["meting"]> = {}): Maatwerk {
  return { id: "w1", ruimteId: leef.id, rand, meting: { methode: "laser", ...meting }, kasten: [], aansluitingen: [] };
}

describe("keuken en maatwerk", () => {
  it("wanden van links naar rechts gezien vanuit de ruimte", () => {
    expect(achter.lengte).toBe(5800);
    expect(achter.a.x).toBeLessThan(achter.b.x); // naar de achtergevel (y+) kijken: links = kleine x
    expect(voor.a.x).toBeGreaterThan(voor.b.x); // naar de voorgevel (y−) kijken: links = grote x
  });

  it("beschikbaar = kleinste gemeten maat; wand vullen met modules en passtuk", () => {
    let w = wand(achter.rand, { onder: 5795, midden: 5800, boven: 5788 });
    expect(beschikbaar(w, achter)).toEqual({ breedte: 5788, bron: "gemeten" });
    w = vulWand(w, achter);
    const vloer = w.kasten.filter((k) => k.soort !== "boven");
    expect(vloer.reduce((s, k) => s + k.breedte, 0)).toBe(5788);
    expect(vloer[0]!.soort).toBe("hoog");
    expect(vloer.some((k) => k.functie === "spoelbak")).toBe(true);
    expect(vloer[vloer.length - 1]!.functie).toBe("vulstuk");
    for (const k of vloer.filter((x) => x.functie !== "vulstuk")) expect([300, 400, 450, 500, 600, 800, 900]).toContain(k.breedte);
    const wb = werkblad(w);
    expect(wb).toHaveLength(1);
    expect(wb[0]!.lengte).toBe(5788 - 600);
    expect(wb[0]!.naden.length).toBe(1); // > 3000 mm
    expect(wb[0]!.uitsparingen.map((u) => u.voor).sort()).toEqual(["kookplaat", "spoelbak"]);
  });

  it("controle: niet gemeten, verschil, te lang, raam, spoelbak zonder afvoer", () => {
    let w = vulWand(wand(voor.rand), voor);
    const p: Project = { ...appartement, maatwerk: [w] };
    const t = controleerKeuken(p, w).map((x) => x.tekst).join("\n");
    expect(t).toContain("Nog niet nagemeten");
    expect(t).toContain("botst met een raam");
    expect(t).toContain("Spoelbak");
    w = { ...wand(achter.rand, { onder: 5700, boven: 5760 }), kasten: [{ id: "k1", soort: "onder", functie: "kast", x: 0, breedte: 5800 }] };
    const t2 = controleerKeuken({ ...appartement, maatwerk: [w] }, w).map((x) => x.tekst).join("\n");
    expect(t2).toContain("verschilt 60 mm");
    expect(t2).toContain("100 mm te lang");
  });

  it("installatiepunten verschijnen op de wand; spoelbak met afvoer is in orde", () => {
    let vv = voegInstallatiepuntToe(v, "spoeltafel", { x: 2500, y: 4550 }).verdieping;
    vv = voegInstallatiepuntToe(vv, "stopcontact", { x: 1000, y: 4600 }).verdieping;
    const p: Project = { ...appartement, verdiepingen: [vv] };
    const w: Maatwerk = { ...wand(achter.rand, { onder: 5800 }), kasten: [{ id: "k1", soort: "onder", functie: "spoelbak", x: 0, breedte: 800 }] };
    const obj = wandObjecten(p, w, wandenVan(vv, vv.ruimtes.find((r) => r.id === leef.id)!)[achter.rand]!);
    expect(obj.map((o) => o.soort)).toEqual(expect.arrayContaining(["afvoer", "koud", "warm", "stopcontact"]));
    // spoelbak bij x = 0..800 vanaf links; spoeltafel staat op x = 2500 → ver van de spoelbak
    const sp = obj.find((o) => o.soort === "afvoer")!;
    const w2 = { ...w, kasten: [{ id: "k1", soort: "onder" as const, functie: "spoelbak" as const, x: Math.max(0, sp.x - 400), breedte: 800 }] };
    expect(controleerKeuken({ ...p, maatwerk: [w2] }, w2).some((x) => x.tekst.startsWith("Spoelbak"))).toBe(false);
  });

  it("aanzicht, lijsten, DXF en PDF", async () => {
    const w = vulWand(wand(achter.rand, { onder: 5790, midden: 5792, boven: 5790 }), achter);
    const p: Project = { ...appartement, maatwerk: [w] };
    expect(leesProject(JSON.parse(JSON.stringify(p))).ok).toBe(true);
    const t = wandAanzicht(p, w);
    expect(t.elementen.filter((e) => e.t === "rect" && e.data).length).toBe(w.kasten.length);
    const s = snijlijst(w);
    expect(s.filter((x) => x.onderdeel === "Zijpaneel").reduce((t, x) => t + x.aantal, 0)).toBeGreaterThan(8);
    expect(s.filter((x) => x.onderdeel.startsWith("Werkblad")).length).toBe(2); // één naad → twee stukken
    const csv = kastenlijstCSV(p, w);
    expect(csv).toContain("Snijlijst: onderdeel");
    expect(csv).toContain("na te meten ter plaatse");
    const dxf = wandAanzichtDXF(p, w);
    expect(dxf).toContain("KASTEN");
    expect(dxf.trimEnd().endsWith("EOF")).toBe(true);
    const { PDFDocument } = await import("pdf-lib");
    expect((await PDFDocument.load(await keukenNaarPDF(p, p.maatwerk, { datum: "2026-11-27" }))).getPageCount()).toBeGreaterThanOrEqual(2);
  });
});

describe("keuken: meting past niet bij de wand", () => {
  it("waarschuwt bij meer dan 20 cm verschil met het plan", () => {
    const w = { ...wand(achter.rand, { onder: 4500 }) };
    expect(controleerKeuken({ ...appartement, maatwerk: [w] }, w).some((x) => x.tekst.includes("wijkt 1300 mm af van het plan"))).toBe(true);
  });
});
