import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { midden, openVoorbeeld, start } from "./hulp.ts";

test("liggers: opening aanklikken, lasten met hulp, resultaat en rekennota", async ({ page }) => {
  const fouten = await start(page);
  await openVoorbeeld(page);
  await page.getByRole("tab", { name: "Liggers" }).click();
  // raam van de leefruimte (2400 mm) aanklikken
  const m = await midden(page, '.plan svg polygon[data-opening^="o-raam-leef"]');
  await page.mouse.click(m.x, m.y);
  await page.getByRole("button", { name: /Nieuwe ligger \(raam 2400 mm\)/ }).click();
  await expect(page.getByLabel("Dagmaat opening (mm)")).toHaveValue("2400");
  await expect(page.locator(".ligger-keuze .groot")).toContainText(/2 × (IPE|HEA|HEB) \d+/);
  // vloer met gebruikslast erbij
  await page.getByText("Last toevoegen met hulp").click();
  await page.getByRole("button", { name: "Vloer", exact: true }).click();
  await page.getByRole("button", { name: "Toevoegen" }).click();
  await expect(page.locator(".lasten tbody tr")).toHaveCount(3);
  await expect(page.locator(".ligger-keuze")).toContainText("1,35·G + 1,5·Q");
  await expect(page.locator(".liggers .gas-waarschuwing")).toContainText("ingenieur");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Rekennota (PDF)" }).click()]);
  expect(readFileSync((await dl.path())!).subarray(0, 4).toString()).toBe("%PDF");
  // bewaard in het project (na herladen nog aanwezig)
  await page.reload();
  await page.getByRole("tab", { name: "Liggers" }).click();
  await expect(page.getByRole("button", { name: "Ligger 1" })).toBeVisible();
  expect(fouten).toEqual([]);
});
