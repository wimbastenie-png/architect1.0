import { describe, expect, it } from "vitest";
import { controleerVloeren, isRoomPlan, leesProject, m2, oppervlakte, roomPlanNaarProject, type RoomPlanInvoer } from "../src/index.ts";

/** Vlak zoals RoomPlan het bewaart: plan-mm → wereld-m (x, y omhoog, z = −plan-y), kolomsgewijze 4×4. */
function vlak(a: { x: number; y: number }, b: { x: number; y: number }, h: number, yMidden: number, extra: Record<string, unknown> = {}) {
  const L = Math.hypot(b.x - a.x, b.y - a.y), ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
  const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return {
    transform: [ux, 0, -uy, 0, 0, 1, 0, 0, -uy, 0, -ux, 0, c.x / 1000, yMidden / 1000, -c.y / 1000, 1],
    dimensions: [L / 1000, h / 1000, 0],
    category: {},
    ...extra,
  };
}

/** Rechthoekige kamer 4000 × 3000 (binnen), gedraaid over `graden`, met ruis en een in tweeën gesplitste muur. */
function kamer(graden: number, ruis = 0): RoomPlanInvoer {
  const t = (graden * Math.PI) / 180;
  let z = 1;
  const r = () => ((z = (z * 16807) % 2147483647) / 2147483647 - 0.5) * 2 * ruis;
  const p = (x: number, y: number) => ({ x: 5000 + x * Math.cos(t) - y * Math.sin(t) + r(), y: -2000 + x * Math.sin(t) + y * Math.cos(t) + r() });
  const H = 2600, ym = H / 2 - 50; // vloer op −50 mm in de ARKit-wereld
  return {
    walls: [
      vlak(p(0, 0), p(2000, 0), H, ym, { identifier: "W1" }),
      vlak(p(2000, 0), p(4000, 0), H, ym, { identifier: "W1b" }),
      vlak(p(4000, 0), p(4000, 3000), H, ym, { identifier: "W2" }),
      vlak(p(0, 3000), p(4000, 3000), H, ym, { identifier: "W3" }), // andere richting dan de rest
      vlak(p(0, 3000), p(0, 0), H, ym, { identifier: "W4" }),
    ],
    doors: [vlak(p(4000, 1000), p(4000, 1900), 2100, 2100 / 2 - 50, { parentIdentifier: "W2" })],
    windows: [vlak(p(1000, 3000), p(2200, 3000), 1300, 900 + 650 - 50)],
    objects: [{}, {}],
  };
}

describe("RoomPlan-omzetting", () => {
  it("herkent een RoomPlan-bestand", () => {
    expect(isRoomPlan(kamer(0))).toBe(true);
    expect(isRoomPlan({ schemaVersie: "0.1" })).toBe(false);
  });

  it.each([0, 30, -72])("kamer gedraaid over %i°: binnenmaten, deur en raam juist", (g) => {
    const { project, meldingen } = roomPlanNaarProject(kamer(g), { nu: "2026-11-26T10:00:00Z" });
    expect(leesProject(project).ok).toBe(true);
    const v = project.verdiepingen[0]!;
    expect(v.muren).toHaveLength(4); // gesplitste muur = één muur
    expect(m2(oppervlakte(v.ruimtes[0]!.contour))).toBe(12);
    expect(v.ruimtes[0]!.plafondhoogte).toBe(2600);
    expect(controleerVloeren(v)).toEqual([]);
    const deur = v.openingen.find((o) => o.soort === "deur")!, raam = v.openingen.find((o) => o.soort === "raam")!;
    expect(deur.breedte).toBe(900);
    expect(deur.borstwering).toBe(0);
    expect(raam.breedte).toBe(1200);
    expect(raam.borstwering).toBe(900);
    expect(raam.hoogte).toBe(1300);
    // afstand van de binnenhoek tot de deur = 1000 (binnenmaat) → langs de hartlijn 1000 + halve dikte
    const m = v.muren.find((x) => x.id === deur.muurId)!;
    const Lm = Math.hypot(m.eind.x - m.start.x, m.eind.y - m.start.y);
    expect(Math.round(Lm)).toBe(3200);
    expect([1100, 3200 - 1100 - 900]).toContain(deur.offset);
    expect(meldingen.join(" ")).toContain("2 meubels");
  });

  it("met meetruis (±15 mm): haaks rechtgezet", () => {
    const { project, meldingen } = roomPlanNaarProject(kamer(12, 15), { nu: "2026-11-26T10:00:00Z" });
    expect(meldingen.join(" ")).toContain("Haaks rechtgezet");
    const c = project.verdiepingen[0]!.ruimtes[0]!.contour;
    for (let k = 0; k < c.length; k++) {
      const a = c[k]!, b = c[(k + 1) % c.length]!;
      expect(a.x === b.x || a.y === b.y).toBe(true);
    }
    expect(Math.abs(m2(oppervlakte(c)) - 12)).toBeLessThan(0.1);
  });

  it("open scan: duidelijke fout", () => {
    const k = kamer(0);
    k.walls.splice(2, 1);
    expect(() => roomPlanNaarProject(k)).toThrow(/sluiten niet aan|geen gesloten ruimte/);
  });
});
