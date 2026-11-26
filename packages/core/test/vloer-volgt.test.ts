import { describe, expect, it } from "vitest";
import { appartement } from "../examples/appartement.ts";
import {
  binnenLengte,
  breekMuurUit,
  controleerSamenhang,
  meetstaat,
  muurLengte,
  oppervlakte,
  rechthoekigProject,
  verplaatsHoek,
  verschuifMuur,
  voegRuimteToe,
  type Muur,
  type Ruimte,
  type Verdieping,
} from "../src/index.ts";

/** Raakt ruimte r het vlak van muur m? (een hoekpunt op ± dikte/2 van de hartlijn, nabij de muur) */
function raakt(r: Ruimte, m: Muur): boolean {
  const L = muurLengte(m), u = { x: (m.eind.x - m.start.x) / L, y: (m.eind.y - m.start.y) / L }, n = { x: -u.y, y: u.x };
  return r.contour.some((q) => {
    const t = (q.x - m.start.x) * u.x + (q.y - m.start.y) * u.y;
    const d = Math.abs((q.x - m.start.x) * n.x + (q.y - m.start.y) * n.y);
    return Math.abs(d - m.dikte / 2) <= 2 && t > -m.dikte * 2 && t < L + m.dikte * 2;
  });
}

const rechthoek = rechthoekigProject({ naam: "x", binnenBreedte: 4000, binnenDiepte: 3000, plafondhoogte: 2600, muurdikte: 200, nu: "2026-11-25T10:00:00Z" });
const r0 = rechthoek.verdiepingen[0]!;
const metV = (v: Verdieping) => ({ ...rechthoek, verdiepingen: [v] });

describe("vloer volgt de muur (gemeld: muur verschuift, vloer niet)", () => {
  // schuine rechtermuur: hoek rechtsboven 1000 mm naar rechts
  const schuin = verplaatsHoek(r0, { x: 4100, y: 3100 }, { x: 5100, y: 3100 });

  it("ondermuur 300 mm omlaag: binnenhoek glijdt langs de schuine muur (14,68 m², niet 14,83)", () => {
    const v = verschuifMuur(schuin, "m-onder", -300);
    // binnenvlak schuine muur op y = −300: x = 4100 − 62,5 − 104,77 = 3932,73; bovenaan 4963,98
    const L = Math.hypot(1000, 3200), sh = (100 * L) / 3200;
    const xOnder = 4100 + (-300 + 100) * (1000 / 3200) - sh, xBoven = 4100 + 3100 * (1000 / 3200) - sh;
    const verwacht = (3300 * (xOnder + xBoven)) / 2;
    expect(Math.abs(oppervlakte(v.ruimtes[0]!.contour) - verwacht)).toBeLessThan(3300 * 2);
    expect(meetstaat(metV(v))[0]!.vloerM2).toBe(14.68);
    for (const m of v.muren) expect(raakt(v.ruimtes[0]!, m)).toBe(true);
    expect(controleerSamenhang(metV(v))).toEqual([]);
  });

  it("de schuine buurmuur houdt zijn richting (wordt enkel langer)", () => {
    const voor = schuin.muren.find((m) => m.id === "m-rechts")!;
    const na = verschuifMuur(schuin, "m-onder", -300).muren.find((m) => m.id === "m-rechts")!;
    const richting = (m: Muur) => Math.atan2(m.eind.y - m.start.y, m.eind.x - m.start.x);
    expect(Math.abs(richting(na) - richting(voor))).toBeLessThan(0.002); // < 0,1° (afronding)
    expect(muurLengte(na)).toBeGreaterThan(muurLengte(voor));
  });

  it("schuine muur zelf verschuiven: vloer volgt", () => {
    const v = verschuifMuur(schuin, "m-rechts", -250);
    for (const m of v.muren) expect(raakt(v.ruimtes[0]!, m)).toBe(true);
    expect(oppervlakte(v.ruimtes[0]!.contour)).toBeGreaterThan(oppervlakte(schuin.ruimtes[0]!.contour));
  });

  it("weigert een hoek die een knik zou maken waar de ruimte geen hoek heeft", () => {
    const v0 = appartement.verdiepingen[0]!;
    // ruimte links tegen de leefruimte: de linkermuur wordt gesplitst op 127 mm van de hoek
    const v1 = voegRuimteToe(v0, { muurId: "m-links", naam: "R0", breedte: 3920, diepte: 2000, afstandVanafA: 127, plafondhoogte: 2600 });
    expect(() => verplaatsHoek(v1, { x: 0, y: 4800 }, { x: -217, y: 4849 })).toThrow(/knik/);
    // maar een knik bij een tussenmuur mag wel: daar hebben beide ruimtes een hoek
    expect(() => verplaatsHoek(v0, { x: 9600, y: 4800 }, { x: 9307, y: 4659 })).not.toThrow();
  });

  it("eigenschap: na elke geslaagde verschuiving raakt elke ruimte haar muren (vaste willekeurige reeksen)", () => {
    let zaad = 7;
    const rnd = () => (zaad = (zaad * 16807) % 2147483647) / 2147483647;
    const kies = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]!;
    let verschuivingen = 0;
    const fouten: string[] = [];
    for (let run = 0; run < 150; run++) {
      let v = kies([appartement.verdiepingen[0]!, r0]);
      for (let stap = 0; stap < 8; stap++) {
        const actie = kies(["ruimte", "hoek", "schuif", "schuif", "schuif", "uitbreken"]);
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
            const m = kies(v.muren), n = verschuifMuur(v, m.id, Math.round((rnd() - 0.5) * 800));
            verschuivingen++;
            const nm = n.muren.find((w) => w.id === m.id)!;
            const kort = muurLengte(nm) < 2 * nm.dikte || muurLengte(m) < 2 * m.dikte; // stukje binnen een hoekzone: bekende beperking
            if (!kort) for (const r of n.ruimtes.filter((x) => x.muurIds.includes(m.id))) if (!raakt(r, nm)) fouten.push(`${m.id} → ${r.naam}`);
            v = n;
          }
        } catch { /* geweigerde bewerking: overslaan */ }
      }
    }
    expect(verschuivingen).toBeGreaterThan(300);
    expect(fouten).toEqual([]);
  });
});
