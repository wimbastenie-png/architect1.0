import { describe, expect, it } from "vitest";
import { appartement } from "../examples/appartement.ts";
import { ifcGuid, projectNaarIFC, voegVerdiepingToe } from "../src/index.ts";

describe("IFC-export", () => {
  const p = voegVerdiepingToe(appartement, { modus: "kopie", naam: "Eerste verdieping" }).project;
  const ifc = projectNaarIFC(p, { tijdstip: "2026-11-26T10:00:00" });

  it("geldig STEP-bestand met IFC4-kop", () => {
    expect(ifc.startsWith("ISO-10303-21;")).toBe(true);
    expect(ifc).toContain("FILE_SCHEMA(('IFC4'));");
    expect(ifc.trimEnd().endsWith("END-ISO-10303-21;")).toBe(true);
    // elke verwijzing #n bestaat
    const gedef = new Set([...ifc.matchAll(/^#(\d+)=/gm)].map((m) => m[1]));
    for (const m of ifc.matchAll(/#(\d+)/g)) expect(gedef.has(m[1])).toBe(true);
  });

  it("muren, ramen, deuren, ruimtes en verdiepingen", () => {
    const tel = (t: string) => ifc.split("\n").filter((r) => r.includes(`=${t}(`)).length;
    const v = p.verdiepingen;
    expect(tel("IFCBUILDINGSTOREY")).toBe(2);
    expect(tel("IFCWALL")).toBe(v.reduce((s, x) => s + x.muren.length, 0));
    expect(tel("IFCSPACE")).toBe(v.reduce((s, x) => s + x.ruimtes.length + x.sparingen.length, 0));
    expect(tel("IFCOPENINGELEMENT")).toBe(v.reduce((s, x) => s + x.openingen.length, 0));
    expect(tel("IFCDOOR") + tel("IFCWINDOW")).toBe(v.reduce((s, x) => s + x.openingen.filter((o) => o.soort !== "doorgang").length, 0));
    expect(ifc).toContain("IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)");
  });

  it("GUID's: 22 tekens, uniek, stabiel bij opnieuw exporteren", () => {
    const guids = [...ifc.matchAll(/\('([0-9A-Za-z_$]{22})'/g)].map((m) => m[1]);
    expect(guids.length).toBeGreaterThan(20);
    expect(new Set(guids).size).toBe(guids.length);
    expect(projectNaarIFC(p, { tijdstip: "2026-11-26T10:00:00" })).toBe(ifc);
    expect(ifcGuid("a")).not.toBe(ifcGuid("b"));
    expect(ifcGuid("x")).toMatch(/^[0-3][0-9A-Za-z_$]{21}$/);
  });

  it("tekst met apostrof en accenten veilig gecodeerd", () => {
    const q = projectNaarIFC({ ...appartement, naam: "Rue de l'Église" });
    expect(q).toContain("'Rue de l''\\X2\\00C9\\X0\\glise'");
  });
});
