import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { vloer } from "./hulp.ts";

// Projectbestand zoals een vorige versie het kon achterlaten: linkermuur schuin,
// vloer van de leefruimte nog met de oude rechte linkerrand (zie de gemelde schermafdruk).
const pad = fileURLToPath(new URL("./fixtures/stuk-vorige-versie.json", import.meta.url));
const stuk = readFileSync(pad, "utf8");

test.describe("vloeren rechtzetten bij het openen", () => {
  test("bewaard op het toestel: automatisch rechtgezet, met melding", async ({ page }) => {
    const fouten: string[] = [];
    page.on("pageerror", (e) => fouten.push(e.message));
    await page.goto("/");
    await page.evaluate((json) => localStorage.setItem("architect1.0:project", json), stuk);
    await page.reload();
    await expect(page.locator(".melding")).toContainText("De vloer van Leefruimte raakte de muren niet meer en is rechtgezet");
    await expect(page.locator(".fouten")).toHaveCount(0);
    await expect(await vloer(page, "Leefruimte")).toHaveText("22,03"); // = oppervlakte als alles goed was gegaan (berekend bij het maken van het testbestand: 22,0302 m²)
    expect(fouten).toEqual([]);
  });

  test("via Openen: zelfde rechtzetting", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('input[type="file"]').setInputFiles(pad);
    await expect(page.locator(".melding")).toContainText("is rechtgezet");
    await expect(await vloer(page, "Leefruimte")).toHaveText("22,03");
  });

  test("een goed plan krijgt geen melding en blijft ongewijzigd", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole("button", { name: "Voorbeeld openen" }).click();
    await expect(page.locator(".melding")).toHaveCount(0);
    await expect(await vloer(page, "Leefruimte")).toHaveText("26,10");
  });
});
