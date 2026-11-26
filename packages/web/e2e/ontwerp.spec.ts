import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openVoorbeeld, start } from "./hulp.ts";

async function opPlan(page: Page, x: number, y: number) {
  return page.evaluate(([px, py]) => {
    const svg = document.querySelector(".plan svg") as SVGSVGElement;
    const p = new DOMPoint(px! - Number(svg.dataset.minX), Number(svg.dataset.maxY) - py!).matrixTransform(svg.getScreenCTM()!);
    return { x: p.x, y: p.y };
  }, [x, y]);
}
const tik = async (page: Page, x: number, y: number) => { const p = await opPlan(page, x, y); await page.mouse.click(p.x, p.y); };

test("ontwerp: muur afbreken, nieuwe muur, snijlijn, gevel en PDF", async ({ page }) => {
  const fouten = await start(page);
  await openVoorbeeld(page);
  await page.getByRole("tab", { name: "Ontwerp" }).click();
  // tussenmuur (x = 6000) afbreken
  await tik(page, 6000, 1500);
  await page.getByRole("button", { name: "Afbreken", exact: true }).click();
  await expect(page.locator('.plan svg polygon[fill="#facc15"]')).toHaveCount(1);
  await expect(page.locator(".ontwerp .aandachtspunten")).toContainText("Stabiliteitsstudie door een ingenieur");
  // nieuwe muur van onder naar boven op x ≈ 3000
  await page.getByRole("button", { name: "Nieuwe muur" }).click();
  await tik(page, 3000, 300);
  await tik(page, 3030, 4500);
  await expect(page.locator('.plan svg polygon[fill="#dc2626"]')).toHaveCount(1);
  // weergave nieuwe toestand: afgebroken muur weg
  await page.getByRole("tab", { name: "Nieuw", exact: true }).click();
  await expect(page.locator('.plan svg polygon[fill="#facc15"]')).toHaveCount(0);
  await page.getByRole("tab", { name: "Verbouwing" }).click();
  // snijlijn
  await page.getByRole("button", { name: "Snijlijn doorsnede" }).click();
  await tik(page, -400, 2400);
  await tik(page, 10000, 2410);
  await expect(page.getByRole("button", { name: "A-A", exact: true })).toBeVisible();
  await expect(page.locator(".ontwerp .schema").first()).toContainText("Leefruimte");
  // gevel
  await page.getByLabel("Zijde").selectOption("links");
  await expect(page.locator(".ontwerp .schema").last()).toContainText("Linkergevel");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Ontwerp (PDF)" }).click()]);
  expect(readFileSync((await dl.path())!).subarray(0, 4).toString()).toBe("%PDF");
  expect(fouten).toEqual([]);
});
