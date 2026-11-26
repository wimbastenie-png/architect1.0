import { expect, test } from "@playwright/test";
import { vloer } from "./hulp.ts";

// Zonder camera: ?ar-demo gebruikt testpunten van twee ruimtes (zelfde sessie), met gemeten hoogtes.
test("camera-demo: twee ruimtes, gemeten hoogtes, haaks waar het kan", async ({ page }) => {
  const fouten: string[] = [];
  page.on("pageerror", (e) => fouten.push(e.message));
  await page.goto("/?ar-demo");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/?ar-demo");
  await page.getByRole("button", { name: "AR-demo met testpunten" }).click();
  await expect(page.getByText("2 ruimtes opgemeten")).toBeVisible();
  await expect(page.getByLabel("Plafondhoogte ruimte 2 (mm) · gemeten")).toHaveValue("2380");
  await expect(page.locator(".ar-meldingen")).toContainText("Ruimte 2: geplaatst tegen de bestaande muur");
  await page.getByLabel("Naam ruimte 2").fill("Berging");
  await page.getByRole("button", { name: "Plan maken" }).click();
  await expect(page.locator(".plan svg")).toBeVisible();
  await expect(await vloer(page, "Berging")).not.toHaveText("");
  expect(fouten).toEqual([]);
});
