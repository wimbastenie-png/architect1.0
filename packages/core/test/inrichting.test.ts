import { describe, expect, it } from "vitest";
import { appartement } from "../examples/appartement.ts";
import {
  controleerInrichting, leesProject, meubelHoeken, model3D, muurPrismas, oppervlakte, overlapt, verdiepingNaarSVG,
  voegMeubelToe, wijzigMeubel, zetAfwerking, type Verdieping,
} from "../src/index.ts";

describe("inrichting", () => {
  const v0 = appartement.verdiepingen[0]!;

  it("meubel plaatsen, draaien; hoeken kloppen", () => {
    let r = voegMeubelToe(v0, "bed2", { x: 7700, y: 2400 });
    const m = r.verdieping.meubels[0]!;
    expect([m.breedte, m.diepte]).toEqual([1600, 2100]);
    expect(Math.round(oppervlakte(meubelHoeken(m)))).toBe(1600 * 2100);
    const gedraaid = wijzigMeubel(r.verdieping, r.id, { hoek: 450 }).meubels[0]!;
    expect(gedraaid.hoek).toBe(90);
    const h = meubelHoeken(gedraaid).map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
    expect(Math.max(...h.map((p) => p.x)) - Math.min(...h.map((p) => p.x))).toBe(2100);
    expect(leesProject(JSON.parse(JSON.stringify({ ...appartement, verdiepingen: [r.verdieping] }))).ok).toBe(true);
    r = voegMeubelToe(r.verdieping, "stoel", { x: 0, y: 0 });
    expect(r.id).not.toBe(m.id);
  });

  it("controles: in een muur, buiten, voor een deur", () => {
    let v: Verdieping = v0;
    v = voegMeubelToe(v, "bed2", { x: 7900, y: 2300 }).verdieping; // goed in de slaapkamer, > 90 cm van de binnendeur
    v = voegMeubelToe(v, "kast", { x: 6000, y: 1500 }).verdieping; // op de tussenmuur
    v = voegMeubelToe(v, "zetel3", { x: 3000, y: 6000 }).verdieping; // buiten
    // binnendeur in m-binnen (x = 6000) van y 3200 tot 4030: kast vlak ervoor in de leefruimte
    v = voegMeubelToe(v, "kleerkast", { x: 5600, y: 3600 }).verdieping;
    v = wijzigMeubel(v, v.meubels[3]!.id, { hoek: 90 });
    const o = controleerInrichting(v);
    expect(o.filter((x) => x.meubelId === v.meubels[0]!.id)).toEqual([]);
    expect(o.find((x) => x.meubelId === v.meubels[1]!.id)!.tekst).toContain("steekt in een muur");
    expect(o.find((x) => x.meubelId === v.meubels[2]!.id)!.tekst).toContain("buiten de ruimtes");
    expect(o.some((x) => x.meubelId === v.meubels[3]!.id && x.tekst.includes("voor een deur"))).toBe(true);
    expect(overlapt([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], [{ x: 2, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 1 }, { x: 2, y: 1 }])).toBe(false);
  });

  it("3D: muren met gaten — volume klopt met muur min openingen", () => {
    const p = muurPrismas(v0).filter((x) => x.soort === "muur" && x.naam === "muur m-onder-links");
    const vol = p.reduce((s, x) => s + oppervlakte(x.punten) * (x.z1 - x.z0), 0);
    const m = v0.muren.find((x) => x.id === "m-onder-links")!;
    const o = v0.openingen.find((x) => x.id === "o-raam-leef")!;
    const vol0 = muurPrismas({ ...v0, openingen: [] }).filter((x) => x.naam === "muur m-onder-links").reduce((s, x) => s + oppervlakte(x.punten) * (x.z1 - x.z0), 0);
    expect(vol0 - vol).toBeCloseTo(o.breedte * m.dikte * o.hoogte, -3);
    expect(muurPrismas(v0).filter((x) => x.soort === "glas")).toHaveLength(2);
  });

  it("3D-model: vloer in materiaalkleur, meubels, afgebroken muur niet in de nieuwe toestand", () => {
    let v = zetAfwerking(v0, v0.ruimtes[0]!.id, { vloer: "parket-eik", wand: "salie" });
    v = voegMeubelToe(v, "eettafel", { x: 3000, y: 2400 }).verdieping;
    v = { ...v, muren: v.muren.map((m) => (m.id === "m-binnen" ? { ...m, toestand: "afbreken" as const } : m)) };
    const p = { ...appartement, verdiepingen: [v] };
    const m = model3D(p);
    expect(m.prismas.find((x) => x.soort === "vloer" && x.naam === "vloer Leefruimte")!.kleur).toBe("#c08a53");
    expect(m.prismas.filter((x) => x.soort === "meubel").length).toBe(5); // blad + 4 poten
    expect(m.prismas.some((x) => x.naam === "muur m-binnen")).toBe(false);
    expect(model3D(p, { toestand: "bestaand" }).prismas.some((x) => x.naam === "muur m-binnen")).toBe(true);
    expect(m.prismas.some((x) => x.soort === "muur" && x.kleur === "#b5c4a8")).toBe(true);
    const svg = verdiepingNaarSVG(v, { interactief: true, meubels: {} });
    expect(svg).toContain("data-meubel=");
  });
});
