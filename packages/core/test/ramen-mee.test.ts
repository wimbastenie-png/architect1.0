import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { appartement } from "../examples/appartement.ts";
import { aansluitingen, herstelVloeren, leesProject, muurLengte, verplaatsHoek, verschuifMuur, wijzigOpening, type Verdieping } from "../src/index.ts";

const binnenAan = (v: Verdieping, id: string) => {
  const o = v.openingen.find((x) => x.id === id)!, m = v.muren.find((x) => x.id === o.muurId)!, a = aansluitingen(m, v.muren);
  return o.offset >= a.start - 0.5 && o.offset + o.breedte <= muurLengte(m) - a.eind + 0.5;
};

describe("ramen en deuren schuiven mee (gemeld: 'past een raam niet meer', muur niet aan te passen)", () => {
  // het rechtgezette plan van de melding: schuine linkermuur, raam R1 dicht bij hoek B
  const p = leesProject(JSON.parse(readFileSync(new URL("../../web/e2e/fixtures/stuk-vorige-versie.json", import.meta.url), "utf8")));
  if (!p.ok) throw new Error("testbestand ongeldig");
  const v = herstelVloeren(p.project.verdiepingen[0]!).verdieping;
  const B = v.muren.find((m) => m.id === "m-links")!.eind;

  it("hoek B 300 mm verder: lukt, het raam schuift net genoeg op", () => {
    const n = verplaatsHoek(v, B, { x: B.x + 300, y: B.y });
    expect(binnenAan(n, "o-raam-leef")).toBe(true);
    const o = n.openingen.find((x) => x.id === "o-raam-leef")!, m = n.muren.find((x) => x.id === o.muurId)!;
    expect(o.offset).toBe(Math.round(aansluitingen(m, n.muren).start)); // tegen de binnenhoek
  });

  it("muur echt te kort: duidelijke melding met de muur en de maat", () => {
    expect(() => verplaatsHoek(v, B, { x: B.x + 2500, y: B.y })).toThrow(/te kort voor het raam van 2400 mm \(Leefruimte — .*: nog \d+ mm\)\. Maak het raam smaller of sleep minder ver/);
  });

  it("muur verschuiven: raam in de aansluitende gevel schuift mee", () => {
    const v0 = appartement.verdiepingen[0]!;
    // linkermuur 1500 mm naar rechts: de ondergevel begint nu waar het raam stond
    const n = verschuifMuur(v0, "m-links", 1500);
    expect(binnenAan(n, "o-raam-leef")).toBe(true);
  });

  it("overlap na het opschuiven: melding in plaats van overlappende ramen", () => {
    const v0 = appartement.verdiepingen[0]!;
    // tweede raam vlak naast het eerste
    const twee = wijzigOpening({ ...v0, openingen: [...v0.openingen, { ...v0.openingen.find((o) => o.id === "o-raam-leef")!, id: "o-extra", offset: 150, breedte: 1200 }] }, "o-extra", { offset: 150 });
    expect(() => verschuifMuur(twee, "m-links", 1600)).toThrow(/overlappen/);
  });
});
