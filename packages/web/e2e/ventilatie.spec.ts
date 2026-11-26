import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openVoorbeeld, start } from "./hulp.ts";

async function tik(page: Page, x: number, y: number) {
  const p = await page.evaluate(([px, py]) => {
    const svg = document.querySelector(".plan svg") as SVGSVGElement;
    const q = new DOMPoint(px! - Number(svg.dataset.minX), Number(svg.dataset.maxY) - py!).matrixTransform(svg.getScreenCTM()!);
    return { x: q.x, y: q.y };
  }, [x, y]);
  await page.mouse.click(p.x, p.y);
}

test("ventilatie: systeem D, debieten, unit en ventielen, kanalen, PDF", async ({ page }) => {
  const fouten = await start(page);
  await openVoorbeeld(page);
  await page.getByRole("tab", { name: "Installaties" }).click();
  await page.getByRole("tab", { name: "Ventilatie" }).click();
  await page.getByLabel("Systeem").selectOption("D");
  await expect(page.locator(".installaties table").first()).toContainText("94 m³/h"); // leefruimte 26,1 m² × 3,6
  await page.getByLabel("Functie Slaapkamer").selectOption("badkamer");
  await expect(page.locator(".installaties table").first()).toContainText("55 m³/h");
  for (const [soort, x, y] of [["Ventilatie-unit", 9000, 4300], ["Toevoerventiel", 3000, 2400], ["Afvoerventiel", 7700, 2400]] as const) {
    await page.getByRole("button", { name: new RegExp(soort) }).click();
    await tik(page, x, y);
    await page.getByRole("button", { name: new RegExp(soort) }).click();
  }
  await expect(page.locator(".plan svg")).toContainText("Ø125");
  await expect(page.locator(".installaties .aandachtspunten")).toContainText("doorstroomopening");
  await expect(page.locator(".installaties")).toContainText("Kanaal Ø 125 mm");
  const [pdf] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Installaties (PDF)" }).click()]);
  expect(readFileSync((await pdf.path())!).subarray(0, 4).toString()).toBe("%PDF");
  expect(fouten).toEqual([]);
});
