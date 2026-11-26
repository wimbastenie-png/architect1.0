import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openVoorbeeld, start } from "./hulp.ts";

/** Schermpunt van een plan-coördinaat (mm). */
async function opPlan(page: Page, x: number, y: number) {
  return page.evaluate(([px, py]) => {
    const svg = document.querySelector(".plan svg") as SVGSVGElement;
    const ctm = svg.getScreenCTM()!;
    const p = new DOMPoint(px! - Number(svg.dataset.minX), Number(svg.dataset.maxY) - py!).matrixTransform(ctm);
    return { x: p.x, y: p.y };
  }, [x, y]);
}

test("installaties: punten plaatsen, kringen, aandachtspunten, gas en PDF", async ({ page }) => {
  const fouten = await start(page);
  await openVoorbeeld(page);
  await page.getByRole("tab", { name: "Installaties" }).click();
  // elektriciteit: verdeelbord, 3 stopcontacten, lichtpunt zonder schakelaar
  await page.getByRole("button", { name: /Verdeelbord/ }).click();
  let p = await opPlan(page, 500, 500); await page.mouse.click(p.x, p.y);
  await page.getByRole("button", { name: /^S Stopcontact$/ }).click();
  for (const x of [1500, 2500, 3500]) { p = await opPlan(page, x, 400); await page.mouse.click(p.x, p.y); }
  await page.getByRole("button", { name: /Lichtpunt \(plafond\)/ }).click();
  p = await opPlan(page, 3000, 2500); await page.mouse.click(p.x, p.y);
  await expect(page.locator(".plan svg [data-installatie]")).toHaveCount(5);
  await expect(page.locator(".installaties table").first()).toContainText("Stopcontacten Gelijkvloers");
  await expect(page.locator(".aandachtspunten")).toContainText("lichtpunt zonder schakelaar");
  // punt aanklikken en verwijderen
  await page.getByRole("button", { name: /Lichtpunt \(plafond\)/ }).click(); // plaatsen uit
  await page.locator(".plan svg [data-installatie]").last().click();
  await expect(page.getByRole("heading", { name: "Lichtpunt (plafond)" })).toBeVisible();
  await page.getByRole("button", { name: "Verwijderen" }).click();
  await expect(page.locator(".plan svg [data-installatie]")).toHaveCount(4);
  // gas: waarschuwing verschijnt
  await page.getByRole("tab", { name: "Gas" }).click();
  await page.getByRole("button", { name: /Gasmeter/ }).click();
  p = await opPlan(page, 500, 2500); await page.mouse.click(p.x, p.y);
  await expect(page.locator(".gas-waarschuwing")).toContainText("bevoegde installateur");
  // PDF
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Installaties (PDF)" }).click()]);
  expect(dl.suggestedFilename()).toMatch(/installaties\.pdf$/);
  expect(readFileSync((await dl.path())!).subarray(0, 4).toString()).toBe("%PDF");
  // terug naar plan: geen symbolen, muren weer klikbaar
  await page.getByRole("tab", { name: "Plan" }).click();
  await expect(page.locator(".plan svg [data-installatie]")).toHaveCount(0);
  expect(fouten).toEqual([]);
});
