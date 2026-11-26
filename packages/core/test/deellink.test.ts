import { describe, expect, it } from "vitest";
import { appartement } from "../examples/appartement.ts";
import { codeNaarProject, codeUitLink, LANGE_LINK, projectNaarCode, voegRuimteToe, voegVerdiepingToe, voegSparingToe } from "../src/index.ts";

describe("deellink", () => {
  it("project → code → zelfde project", async () => {
    const code = await projectNaarCode(appartement);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/); // veilig in een link
    const terug = await codeNaarProject(code);
    expect(terug.ok).toBe(true);
    if (terug.ok) expect(terug.project).toEqual(appartement);
  });

  it("groter project (2 verdiepingen, aanbouw, trapgat) blijft ruim onder de lange-linkgrens", async () => {
    let p = voegVerdiepingToe(appartement, { modus: "kopie", naam: "Eerste verdieping" }).project;
    const v0 = voegRuimteToe(p.verdiepingen[0]!, { muurId: "m-rechts", naam: "Berging", breedte: 2000, diepte: 1500, afstandVanafA: 1000, plafondhoogte: 2400 });
    const v1 = voegSparingToe(p.verdiepingen[1]!, { ruimteId: p.verdiepingen[1]!.ruimtes[0]!.id, soort: "trapgat", x: 0, y: 0, breedte: 1000, lengte: 2800 });
    p = { ...p, verdiepingen: [v0, v1] };
    const code = await projectNaarCode(p);
    expect(code.length).toBeLessThan(LANGE_LINK);
    const json = JSON.stringify(p).length;
    expect(code.length).toBeLessThan(json * 0.5); // compressie werkt
    const terug = await codeNaarProject(code);
    expect(terug.ok && terug.project).toEqual(p);
  });

  it("beschadigde of onvolledige link: duidelijke melding, geen crash", async () => {
    const code = await projectNaarCode(appartement);
    const kapot = await codeNaarProject(code.slice(0, Math.floor(code.length / 2)));
    expect(kapot.ok).toBe(false);
    if (!kapot.ok) expect(kapot.fouten[0]!.melding).toMatch(/onvolledig of beschadigd/);
    expect((await codeNaarProject("!!!")).ok).toBe(false);
  });

  it("code uit een volledig adres halen", () => {
    expect(codeUitLink("https://wimbastenie-png.github.io/architect1.0/#p=abc_-1")).toBe("abc_-1");
    expect(codeUitLink("#p=xyz")).toBe("xyz");
    expect(codeUitLink("https://wimbastenie-png.github.io/architect1.0/")).toBeNull();
    expect(codeUitLink("#iets-anders")).toBeNull();
  });
});
