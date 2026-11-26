import { describe, expect, it } from "vitest";
import { controleerSamenhang, controleerVloeren, haaksWaarHetKan, m2, oppervlakte, projectUitCamera } from "../src/index.ts";

const draai = (pts: { x: number; y: number }[], g: number, dx = 0, dy = 0) => {
  const a = (g * Math.PI) / 180;
  return pts.map((p) => ({ x: Math.round(dx + p.x * Math.cos(a) - p.y * Math.sin(a)), y: Math.round(dy + p.x * Math.sin(a) + p.y * Math.cos(a)) }));
};

describe("camera-opmeting verfijnd", () => {
  it("haaks waar het kan: schuine muur blijft schuin, de rest wordt haaks", () => {
    // trapezium: rechtse muur echt schuin (± 18°), kleine tikfouten elders
    const pts = draai([{ x: 0, y: 0 }, { x: 5000, y: 40 }, { x: 4000, y: 3020 }, { x: -30, y: 3000 }], 25, 1000, 500);
    const r = haaksWaarHetKan(pts, 8);
    expect(r.schuin).toBe(1);
    expect(r.punten).toHaveLength(4);
    const c = r.punten;
    let haaks = 0;
    for (let k = 0; k < 4; k++) { const a = c[k]!, b = c[(k + 1) % 4]!; if (a.x === b.x || a.y === b.y) haaks++; }
    expect(haaks).toBe(3);
    expect(Math.abs(m2(oppervlakte(c)) - 13.5)).toBeLessThan(0.15);
  });

  it("twee ruimtes in één sessie: tweede komt tegen de muur van de eerste", () => {
    const k1 = draai([{ x: 0, y: 0 }, { x: 4000, y: 20 }, { x: 3990, y: 3000 }, { x: 10, y: 3010 }], 40);
    // tweede ruimte rechts, achter een muur van 200 mm: binnenvlak op x = 4200, breedte (langs de muur) 2500, diepte 2800
    const k2 = draai([{ x: 4210, y: 0 }, { x: 7000, y: 10 }, { x: 7000, y: 2500 }, { x: 4200, y: 2490 }], 40);
    const { project, meldingen } = projectUitCamera(
      [{ naam: "Keuken", punten: k1, plafondhoogte: 2600 }, { naam: "Berging", punten: k2, plafondhoogte: 2400 }],
      { naam: "Test", muurdikte: 200, tolerantie: 8, nu: "2026-11-26T10:00:00Z" },
    );
    const v = project.verdiepingen[0]!;
    expect(v.ruimtes.map((r) => r.naam)).toEqual(["Keuken", "Berging"]);
    expect(controleerSamenhang(project)).toEqual([]);
    expect(controleerVloeren(v)).toEqual([]);
    const berging = v.ruimtes[1]!;
    expect(berging.plafondhoogte).toBe(2400);
    expect(Math.abs(m2(oppervlakte(berging.contour)) - 7.0)).toBeLessThan(0.3);
    expect(berging.bron.methode).toBe("gescand");
    // één tussenmuur gedeeld door beide ruimtes
    const gedeeld = v.muren.filter((m) => v.ruimtes.every((r) => r.muurIds.includes(m.id)));
    expect(gedeeld).toHaveLength(1);
    expect(meldingen.join(" ")).toContain("Berging: geplaatst");
  });

  it("tweede ruimte ver weg: overgeslagen met uitleg", () => {
    const k1 = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }];
    const k2 = [{ x: 9000, y: 0 }, { x: 11000, y: 0 }, { x: 11000, y: 2000 }, { x: 9000, y: 2000 }];
    const { project, meldingen } = projectUitCamera([{ naam: "A", punten: k1, plafondhoogte: 2600 }, { naam: "B", punten: k2, plafondhoogte: 2600 }], { naam: "T", muurdikte: 200, tolerantie: 8 });
    expect(project.verdiepingen[0]!.ruimtes).toHaveLength(1);
    expect(meldingen.join(" ")).toContain("B overgeslagen");
  });

  it("tolerantie 0: alles zoals gemeten (schuine muren toegelaten)", () => {
    const k1 = [{ x: 0, y: 0 }, { x: 4000, y: 300 }, { x: 3500, y: 3200 }, { x: -200, y: 2900 }];
    const { project } = projectUitCamera([{ naam: "A", punten: k1, plafondhoogte: 2600 }], { naam: "T", muurdikte: 200, tolerantie: 0 });
    expect(controleerVloeren(project.verdiepingen[0]!)).toEqual([]);
  });
});
