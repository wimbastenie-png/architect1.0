import { expect, test } from "@playwright/test";
import { openVoorbeeld, start, vloer } from "./hulp.ts";

test.describe("ruimtes opbouwen en bewerken", () => {
  test("ruimtes toevoegen, te brede ruimte geweigerd", async ({ page }) => {
    const fouten = await start(page);
    await page.getByLabel("Projectnaam").fill("Woning Dorpsstraat 3");
    await page.getByLabel("Naam ruimte").fill("Badkamer");
    await page.getByLabel("Binnenbreedte (mm)").fill("2400");
    await page.getByLabel("Binnendiepte (mm)").fill("1800");
    await page.getByLabel("Muurdikte (mm)").fill("200");
    await page.getByRole("button", { name: "Plan maken" }).click();
    const voegToe = async (muur: string, naam: string, breedte: string, diepte: string) => {
      await page.locator(`[data-muur="${muur}"]`).first().click({ force: true });
      await page.getByRole("button", { name: "+ Ruimte hiernaast toevoegen" }).click();
      await page.getByLabel("Naam nieuwe ruimte").fill(naam);
      await page.getByLabel("Breedte langs deze muur").fill(breedte);
      await page.getByLabel("Diepte").fill(diepte);
      await page.getByRole("button", { name: "Ruimte toevoegen" }).click();
    };
    await voegToe("m-rechts", "Te breed", "2500", "3000");
    await expect(page.locator(".melding")).toContainText("past niet langs deze muur");
    await page.locator(".melding button").click();
    await page.getByRole("button", { name: "Annuleren" }).click();
    await voegToe("m-rechts", "Slaapkamer", "1800", "3200");
    await voegToe("m-boven", "Gang", "2400", "1200");
    await expect(await vloer(page, "Slaapkamer")).toHaveText("5,76");
    await expect(await vloer(page, "Gang")).toHaveText("2,88");
    await expect(page.locator(".fouten")).toHaveCount(0);
    expect(fouten).toEqual([]);
  });

  test("muur verschuiven met de knop en ongedaan maken", async ({ page }) => {
    const fouten = await start(page);
    await openVoorbeeld(page);
    await page.locator('[data-muur="m-binnen"]').first().click({ force: true });
    await page.getByLabel("Verschuiven over (mm)").fill("200");
    await page.getByRole("button", { name: "Verschuif naar rechts" }).click();
    await expect(await vloer(page, "Leefruimte")).toHaveText("27,00");
    await expect(await vloer(page, "Slaapkamer")).toHaveText("14,40");
    await page.getByRole("button", { name: "Ongedaan maken" }).click();
    await expect(await vloer(page, "Leefruimte")).toHaveText("26,10");
    expect(fouten).toEqual([]);
  });

  test("berging toevoegen en uitbreken tot een L-vormige ruimte", async ({ page }) => {
    const fouten = await start(page);
    await openVoorbeeld(page);
    await page.locator('[data-muur="m-rechts"]').first().click({ force: true });
    await page.getByRole("button", { name: "+ Ruimte hiernaast toevoegen" }).click();
    await page.getByLabel("Naam nieuwe ruimte").fill("Berging");
    await page.getByLabel("Breedte langs deze muur").fill("2000");
    await page.getByLabel("Diepte").fill("1500");
    await page.getByLabel("Begint op (mm van hoek A)").fill("1000");
    await page.getByRole("button", { name: "Ruimte toevoegen" }).click();
    await page.locator('[data-muur="m-rechts-1"]').first().click({ force: true });
    await page.getByRole("button", { name: "Muur uitbreken" }).click();
    await expect(await vloer(page, "Slaapkamer + Berging")).toHaveText("18,90");
    await expect(page.locator(".melding")).toHaveCount(0);
    expect(fouten).toEqual([]);
  });

  test("trapgat toevoegen, verplaatsen, en buiten de ruimte geweigerd", async ({ page }) => {
    const fouten = await start(page);
    await openVoorbeeld(page);
    await page.locator('[data-ruimte="r-leef"]').first().click({ force: true });
    await page.getByRole("button", { name: "+ Sparing in de vloer" }).click();
    await page.getByRole("button", { name: "Sparing toevoegen" }).click();
    await page.locator(".openingen li", { hasText: "trapgat" }).getByRole("button", { name: "Wijzig" }).click();
    await page.getByLabel("Van links").fill("500");
    await page.getByRole("button", { name: "Opslaan" }).click();
    await expect(page.locator(".openingen li", { hasText: "trapgat" })).toContainText("op 500 van links");
    await page.locator(".openingen li", { hasText: "trapgat" }).getByRole("button", { name: "Wijzig" }).click();
    await page.getByLabel("Van links").fill("9000");
    await page.getByRole("button", { name: "Opslaan" }).click();
    await expect(page.locator(".melding")).toContainText("Het trapgat valt (deels) buiten");
    expect(fouten).toEqual([]);
  });
});
