import { describe, expect, it } from "vitest";
import { appartement } from "../examples/appartement.ts";
import {
  binnenLengte,
  breekMuurUit,
  controleerVloeren,
  herstelVloeren,
  oppervlakte,
  rechthoekigProject,
  verplaatsHoek,
  verschuifMuur,
  voegRuimteToe,
  type Verdieping,
} from "../src/index.ts";

const v0 = appartement.verdiepingen[0]!;

describe("vloeren rechtzetten (stukke toestand uit een vorige versie)", () => {
  // Zoals op de schermafdruk: linkermuur schuin, vloer met nog een rechte linkerrand
  const goed = verplaatsHoek(verplaatsHoek(v0, { x: 0, y: 0 }, { x: 1235, y: 160 }), { x: 0, y: 4800 }, { x: -41, y: 4400 });
  const stuk: Verdieping = { ...goed, ruimtes: goed.ruimtes.map((r) => (r.id === "r-leef" ? { ...r, contour: v0.ruimtes[0]!.contour } : r)) };

  it("spoort de stukke vloer op", () => {
    expect(controleerVloeren(goed)).toEqual([]);
    const p = controleerVloeren(stuk);
    expect(p.map((x) => x.ruimte)).toContain("Leefruimte");
    expect(p.some((x) => x.muurId === "m-links")).toBe(true);
  });

  it("zet ze recht: zelfde vloer als wanneer alles goed was gegaan", () => {
    const { verdieping, hersteld, mislukt } = herstelVloeren(stuk);
    expect(hersteld).toEqual(["Leefruimte"]);
    expect(mislukt).toEqual([]);
    expect(controleerVloeren(verdieping)).toEqual([]);
    const opp = (v: Verdieping) => oppervlakte(v.ruimtes.find((r) => r.id === "r-leef")!.contour);
    expect(Math.abs(opp(verdieping) - opp(goed))).toBeLessThan(5000); // < 0,005 m² (afronding)
    // de slaapkamer was niet stuk en blijft exact gelijk
    expect(verdieping.ruimtes.find((r) => r.id === "r-slaap")).toEqual(stuk.ruimtes.find((r) => r.id === "r-slaap"));
  });

  it("verandert niets aan goede plannen (vaste willekeurige reeksen, ook L-vormen en aanbouwen)", () => {
    let zaad = 11;
    const rnd = () => (zaad = (zaad * 16807) % 2147483647) / 2147483647;
    const kies = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]!;
    const r0 = rechthoekigProject({ naam: "x", binnenBreedte: 4000, binnenDiepte: 3000, plafondhoogte: 2600, muurdikte: 200 }).verdiepingen[0]!;
    let gecontroleerd = 0;
    const gewijzigd: string[] = [];
    for (let run = 0; run < 120; run++) {
      let v = kies([v0, r0]);
      for (let stap = 0; stap < 8; stap++) {
        const actie = kies(["ruimte", "hoek", "schuif", "schuif", "uitbreken"]);
        try {
          if (actie === "ruimte") {
            const m = kies(v.muren.filter((w) => v.ruimtes.filter((r) => r.muurIds.includes(w.id)).length === 1));
            const b = Math.floor(binnenLengte(m, v.muren)), br = Math.max(800, Math.floor(b * (0.4 + rnd() * 0.6)));
            v = voegRuimteToe(v, { muurId: m.id, naam: `R${stap}`, breedte: br, diepte: 1500 + Math.floor(rnd() * 2000), afstandVanafA: Math.floor((b - br) * rnd()), plafondhoogte: 2600 });
          } else if (actie === "hoek") {
            const m = kies(v.muren), p = rnd() < 0.5 ? m.start : m.eind;
            v = verplaatsHoek(v, p, { x: p.x + Math.round((rnd() - 0.5) * 1000), y: p.y + Math.round((rnd() - 0.5) * 1000) });
          } else if (actie === "uitbreken") {
            v = breekMuurUit(v, kies(v.muren.filter((w) => v.ruimtes.filter((r) => r.muurIds.includes(w.id)).length === 2)).id);
          } else {
            v = verschuifMuur(v, kies(v.muren).id, Math.round((rnd() - 0.5) * 800));
          }
        } catch { /* geweigerd */ }
        // enkel plannen zonder (bekende) problemen: daar mag rechtzetten niets doen
        if (controleerVloeren(v).length === 0) {
          gecontroleerd++;
          const h = herstelVloeren(v);
          if (h.verdieping !== v) gewijzigd.push(h.hersteld.join(","));
        }
      }
    }
    expect(gecontroleerd).toBeGreaterThan(500);
    expect(gewijzigd).toEqual([]);
  });
});
