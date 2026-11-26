import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { midden, openVoorbeeld, start } from "./hulp.ts";

// 1×1 PNG als "foto"
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("energie: noordpijl, muur met lagen, raam, foto, beschermd volume, PDF en Excel", async ({ page }) => {
  const fouten = await start(page);
  await openVoorbeeld(page);
  await page.getByRole("tab", { name: "Energie" }).click();
  await expect(page.locator(".plan svg [data-noordpijl]")).toHaveCount(1);
  await page.getByRole("button", { name: "Noordpijl 15 graden naar rechts" }).click();
  await expect(page.getByLabel("Noorden (graden)")).toHaveValue("15");

  // linkermuur: lagen
  let m = await midden(page, '.plan svg polygon[data-muur^="m-links"]:not([data-opening])');
  await page.mouse.click(m.x, m.y + 80);
  await expect(page.locator(".epb h3").first()).toContainText("links");
  await page.getByRole("button", { name: "+ Laag" }).click();
  await page.getByRole("button", { name: "+ Laag" }).click();
  await page.getByLabel("Laag 2", { exact: true }).selectOption("Minerale wol (glas/rots)");
  await page.getByLabel("Dikte laag 2 (mm)").fill("60");
  await expect(page.locator(".u-waarde").first()).toContainText("(berekend)");
  await page.locator('.epb input[type="file"]').first().setInputFiles({ name: "muur.png", mimeType: "image/png", buffer: PNG });
  await expect(page.locator(".epb .duim")).toHaveCount(1);
  await page.getByLabel("Bron").first().fill("vaststelling");

  // raam
  m = await midden(page, '.plan svg polygon[data-opening^="o-raam-leef"]');
  await page.mouse.click(m.x, m.y);
  await page.getByLabel("Glas").selectOption("Hoogrendementsglas (HR++)");
  await page.getByLabel("Schrijnwerk").selectOption("PVC");
  await expect(page.locator(".u-waarde")).toContainText("1,25");

  // invoerlijst en exports
  await page.getByRole("button", { name: "Sluiten" }).first().click();
  await expect(page.locator(".epb")).toContainText("111,78 m³");
  const [pdf] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "EPB-inventaris (PDF)" }).click()]);
  expect(readFileSync((await pdf.path())!).subarray(0, 4).toString()).toBe("%PDF");
  const [csv] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Invoerlijst (Excel)" }).click()]);
  const tekst = readFileSync((await csv.path())!, "utf8");
  expect(tekst).toMatch(/muur;Gelijkvloers;Muur m-links;buiten;W;/);
  expect(tekst).toMatch(/raam;Gelijkvloers;Raam o-raam-leef \(2400 × 1500\);buiten;Z;/);
  expect(tekst).toContain("glas: Hoogrendementsglas (HR++) (Ug 1,1)");
  expect(tekst).toContain("Geen EPC-score");
  expect(fouten).toEqual([]);
});
