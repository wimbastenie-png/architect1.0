import { describe, expect, it } from "vitest";
import { appartement } from "../examples/appartement.ts";
import { BTW6_VOORWAARDEN, leesProject, nieuweVordering, offerteNaarPDF, offerteRegels, vorderingsstaat, vorderingsstaatNaarPDF, type Project } from "../src/index.ts";

const prijzen = { "01": 50, "03": 20, "10": 450 };
const firma = { naam: "Bouwbedrijf Voorbeeld bv", adres: "Werfstraat 1, 9000 Gent", btw: "BE0123.456.789", iban: "BE00 0000 0000 0000" };

describe("werf: offerte en vorderingsstaat", () => {
  it("offerte: alleen posten met een prijs, totaal klopt", () => {
    const o = offerteRegels(appartement, prijzen);
    expect(o.regels.map((x) => x.code)).toEqual(["01", "03", "10"]);
    expect(o.regels[0]!.bedrag).toBeCloseTo(41.4 * 50, 2);
    expect(o.excl).toBeCloseTo(o.regels.reduce((s, x) => s + x.bedrag, 0), 2);
    expect(o.zonderPrijs).toContain("02");
  });

  it("vorderingsstaten: cumulatief, deze staat = verschil met de vorige", () => {
    let p: Project = nieuweVordering(appartement, "2026-12-01");
    p = { ...p, vorderingen: p.vorderingen.map((v) => ({ ...v, procent: { "01": 50, "03": 100 } })) };
    p = nieuweVordering(p, "2027-01-01");
    expect(p.vorderingen).toHaveLength(2);
    expect(p.vorderingen[0]!.afgesloten).toBe(true);
    expect(p.vorderingen[1]!.procent["01"]).toBe(50); // vertrekt van de vorige
    p = { ...p, vorderingen: p.vorderingen.map((v) => (v.nr === 2 ? { ...v, procent: { ...v.procent, "01": 100 } } : v)) };
    const s1 = vorderingsstaat(p, prijzen, 1), s2 = vorderingsstaat(p, prijzen, 2);
    const vloer = 41.4 * 50;
    expect(s1.regels.find((x) => x.code === "01")!.dezeStaat).toBeCloseTo(vloer / 2, 2);
    expect(s2.regels.find((x) => x.code === "01")!.dezeStaat).toBeCloseTo(vloer / 2, 2);
    expect(s2.regels.find((x) => x.code === "03")!.dezeStaat).toBe(0);
    expect(s2.dezeStaat).toBeCloseTo(s2.totaalUitgevoerd - s1.totaalUitgevoerd, 2);
    expect(leesProject(JSON.parse(JSON.stringify(p))).ok).toBe(true);
  });

  it("PDF's: offerte met 6 %-voorwaarden en logo; vorderingsstaat", async () => {
    const { PDFDocument } = await import("pdf-lib");
    // 1×1 PNG als logo
    const logo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const bytes = await offerteNaarPDF(appartement, prijzen, { ...firma, logo }, { nummer: "2026-001", datum: "2026-11-27", klant: "Familie Peeters", btwPct: 6, geldigheidDagen: 30, betaling: "30 % voorschot" });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThanOrEqual(1);
    const { execFileSync } = await import("node:child_process");
    const { writeFileSync, mkdtempSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const pad = join(mkdtempSync(join(tmpdir(), "off-")), "o.pdf");
    writeFileSync(pad, bytes);
    let t = "";
    try { t = execFileSync("pdftotext", [pad, "-"], { encoding: "utf8" }).replace(/\s+/g, " "); } catch { return; }
    expect(t).toContain("OFFERTE 2026-001");
    expect(t).toContain("Btw 6 %");
    expect(t).toContain(BTW6_VOORWAARDEN.slice(0, 40));
    expect(t).toContain("vakman controleert en tekent af");
    const p = nieuweVordering(appartement, "2026-12-01");
    expect((await PDFDocument.load(await vorderingsstaatNaarPDF(p, prijzen, firma, 1, 21))).getPageCount()).toBe(1);
  });
});
