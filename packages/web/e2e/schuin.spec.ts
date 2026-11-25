import { expect, test, type Page } from "@playwright/test";
import { midden, muisSleep, openVoorbeeld, schaal, start, vloer } from "./hulp.ts";

/** Nieuw project: rechthoek 4000 × 3000 binnen, muren 200 mm. */
async function rechthoek(page: Page) {
  await page.getByLabel("Projectnaam").fill("Trapezium");
  await page.getByLabel("Naam ruimte").fill("Living");
  await page.getByLabel("Binnenbreedte (mm)").fill("4000");
  await page.getByLabel("Binnendiepte (mm)").fill("3000");
  await page.getByLabel("Muurdikte (mm)").fill("200");
  await page.getByRole("button", { name: "Plan maken" }).click();
  await expect(await vloer(page, "Living")).toHaveText("12,00");
}

test.describe("schuine muren", () => {
  test("hoek B van de rechtermuur 1000 mm naar rechts (formulier) → trapezium 13,49 m²", async ({ page }) => {
    const fouten = await start(page);
    await rechthoek(page);
    await page.locator('polygon[data-muur="m-rechts"]').first().click({ force: true });
    await page.getByLabel("Welke hoek").selectOption("eind");
    await page.getByLabel("Naar rechts (mm)").fill("1000");
    await page.getByRole("button", { name: "Hoek verplaatsen" }).click();
    await expect(await vloer(page, "Living")).toHaveText("13,49");
    await expect(page.locator(".melding")).toHaveCount(0);
    await expect(page.locator(".fouten")).toHaveCount(0);
    expect(fouten).toEqual([]);
  });

  test("hoek slepen met de muis; één keer ongedaan maken", async ({ page }) => {
    const fouten = await start(page);
    await rechthoek(page);
    await page.locator('polygon[data-muur="m-rechts"]').first().click({ force: true });
    const s = await schaal(page);
    const c = await midden(page, 'circle[data-hoek="4100,3100"]');
    await muisSleep(page, c, { x: c.x + 1000 * s, y: c.y });
    await expect(page.locator(".sleep-info")).toHaveText("Hoek 1000 mm naar rechts");
    await page.mouse.up();
    await expect(await vloer(page, "Living")).toHaveText("13,49");
    await page.getByRole("button", { name: "Ongedaan maken" }).click();
    await expect(await vloer(page, "Living")).toHaveText("12,00");
    expect(fouten).toEqual([]);
  });

  test("hoek waar drie muren samenkomen wordt geweigerd", async ({ page }) => {
    await start(page);
    await openVoorbeeld(page);
    await page.locator('polygon[data-muur="m-binnen"]').first().click({ force: true });
    await page.getByLabel("Welke hoek").selectOption("start");
    await page.getByLabel("Naar rechts (mm)").fill("100");
    await page.getByRole("button", { name: "Hoek verplaatsen" }).click();
    await expect(page.locator(".melding")).toContainText("meer dan twee muren");
  });

  test("serre tegen een schuine muur, dan de muur uitbreken", async ({ page }) => {
    const fouten = await start(page);
    await rechthoek(page);
    await page.locator('polygon[data-muur="m-rechts"]').first().click({ force: true });
    await page.getByLabel("Welke hoek").selectOption("eind");
    await page.getByLabel("Naar rechts (mm)").fill("1000");
    await page.getByRole("button", { name: "Hoek verplaatsen" }).click();
    await page.getByRole("button", { name: "+ Ruimte hiernaast toevoegen" }).click();
    await page.getByLabel("Naam nieuwe ruimte").fill("Serre");
    // breedte = de voorgestelde binnenmaat van de schuine muur
    await page.getByLabel("Breedte langs deze muur").fill(String(Math.floor(Number(await page.getByLabel("Breedte langs deze muur").inputValue()))));
    await page.getByLabel("Diepte").fill("2000");
    await page.getByRole("button", { name: "Ruimte toevoegen" }).click();
    await expect(page.locator(".melding")).toHaveCount(0);
    await expect(page.locator(".paneel tbody tr", { hasText: "Serre" })).toHaveCount(1);
    await page.locator('polygon[data-muur="m-rechts"]').first().click({ force: true });
    await page.getByRole("button", { name: "Muur uitbreken" }).click();
    await expect(page.locator(".melding")).toHaveCount(0);
    const samen = page.locator(".paneel tbody tr", { hasText: "Living + Serre" });
    await expect(samen).toHaveCount(1);
    const opp = Number((await samen.locator("td").nth(1).textContent())!.replace(",", "."));
    expect(opp).toBeGreaterThan(13.49 + 6.5); // living + serre (≥ 3,2 m × 2 m) + doorgang
    await expect(page.locator(".fouten")).toHaveCount(0);
    expect(fouten).toEqual([]);
  });
});
