import { expect, test } from "@playwright/test";
import { start, vloer } from "./hulp.ts";

test("badkamer uit binnenmaten: maat, raam, PDF, ongedaan maken, bewaren", async ({ page }) => {
  const fouten = await start(page);
  await page.getByLabel("Projectnaam").fill("Badkamer Kerkstraat 5");
  await page.getByLabel("Naam ruimte").fill("Badkamer");
  await page.getByLabel("Binnenbreedte (mm)").fill("2400");
  await page.getByLabel("Binnendiepte (mm)").fill("1800");
  await page.getByLabel("Plafondhoogte (mm)").fill("2500");
  await page.getByLabel("Muurdikte (mm)").fill("140");
  await page.getByRole("button", { name: "Plan maken" }).click();
  await expect(await vloer(page, "Badkamer")).toHaveText("4,32");

  // binnenmaat aanpassen met de laser
  await page.locator('[data-muur="m-onder"]').first().click({ force: true });
  await expect(page.getByLabel("Binnenmaat (mm), van hoek tot hoek")).toHaveValue("2400");
  await page.getByLabel("Binnenmaat (mm), van hoek tot hoek").fill("2500");
  await page.getByLabel(/^Gemeten met/).selectOption("laser");
  await page.getByRole("button", { name: "Maat toepassen" }).click();
  await expect(await vloer(page, "Badkamer")).toHaveText("4,50");

  // raam toevoegen: wand netto = 8,6 m × 2,5 m − 1,2 × 1,4 = 19,82 m²
  await page.getByLabel("Afstand vanaf hoek A").fill("600");
  await page.getByRole("button", { name: "Opening toevoegen" }).click();
  await expect(page.locator(".openingen li span").first()).toContainText("raam 1200 × 1400");
  await expect(page.locator(".paneel tbody tr").first().locator("td").nth(2)).toHaveText("19,82");

  // PDF downloaden
  const [pdf] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "PDF-plan" }).click()]);
  expect(pdf.suggestedFilename()).toBe("badkamer-kerkstraat-5.pdf");

  // te groot raam → duidelijke melding
  await page.getByLabel("Afstand vanaf hoek A").fill("2000");
  await page.getByRole("button", { name: "Opening toevoegen" }).click();
  await expect(page.locator(".melding")).toContainText("past niet in deze muur");

  // ongedaan maken (2×) en automatisch bewaren
  await page.getByRole("button", { name: "Ongedaan maken" }).click();
  await page.getByRole("button", { name: "Ongedaan maken" }).click();
  await expect(await vloer(page, "Badkamer")).toHaveText("4,32");
  await page.reload();
  await expect(page.locator(".projectnaam")).toHaveText("Badkamer Kerkstraat 5");
  expect(fouten).toEqual([]);
});
