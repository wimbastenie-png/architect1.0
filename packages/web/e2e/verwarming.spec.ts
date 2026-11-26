import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openVoorbeeld, start } from "./hulp.ts";

async function tik(page: Page, x: number, y: number) {
  await page.locator(".plan").first().scrollIntoViewIfNeeded();
  const p = await page.evaluate(([px, py]) => {
    const svg = document.querySelector(".plan svg") as SVGSVGElement;
    const q = new DOMPoint(px! - Number(svg.dataset.minX), Number(svg.dataset.maxY) - py!).matrixTransform(svg.getScreenCTM()!);
    return { x: q.x, y: q.y };
  }, [x, y]);
  await page.mouse.click(p.x, p.y);
}

test("verwarming: warmteverlies, afgifte, warmtepomp op het plan, zonnepanelen, PDF", async ({ page }) => {
  const fouten = await start(page);
  await openVoorbeeld(page);
  // eerst een dak (voor de zonnepanelen)
  await page.getByRole("tab", { name: "Ontwerp" }).click();
  await page.getByText(/^Dak \(/).click();
  await page.getByLabel("Soort dak").selectOption("zadel");
  await page.getByRole("tab", { name: "Installaties" }).click();
  await page.getByRole("tab", { name: "Verwarming" }).click();
  const tabel = page.locator(".installaties table").first();
  await expect(tabel).toContainText("Leefruimte *");
  const w0 = await tabel.locator("tr", { hasText: "Leefruimte" }).locator("td").nth(2).innerText();
  await page.getByLabel("Ontwerpbuitentemperatuur (°C)").fill("-10");
  await expect.poll(async () => +(await tabel.locator("tr", { hasText: "Leefruimte" }).locator("td").nth(2).innerText())).toBeGreaterThan(+w0);
  await page.getByLabel("Afgifte Slaapkamer").selectOption("vloer");
  await expect(page.locator(".installaties")).toContainText("Warmtepomp ±");
  await expect(page.locator(".installaties table").last()).toContainText("Z");
  // warmtepomp en radiator op het plan
  await page.getByRole("button", { name: /Warmtepomp \(binnendeel\)/ }).click();
  await tik(page, 9000, 4300);
  await page.getByRole("button", { name: /Warmtepomp \(binnendeel\)/ }).click();
  await expect(page.locator(".plan svg [data-installatie]")).toHaveCount(1);
  const [pdf] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Installaties (PDF)" }).click()]);
  expect(readFileSync((await pdf.path())!).subarray(0, 4).toString()).toBe("%PDF");
  expect(fouten).toEqual([]);
});
