import { expect, test } from "@playwright/test";
import { midden, muisSleep, openVoorbeeld, schaal, start, vloer } from "./hulp.ts";

test.describe("slepen met de muis", () => {
  test("muur 200 mm slepen; één keer ongedaan maken zet alles terug", async ({ page }) => {
    const fouten = await start(page);
    await openVoorbeeld(page);
    const s = await schaal(page);
    const c = await midden(page, 'polygon[data-muur="m-binnen"]');
    await muisSleep(page, c, { x: c.x + 200 * s, y: c.y });
    await expect(page.locator(".sleep-info")).toHaveText("Muur 200 mm naar rechts");
    await page.mouse.up();
    await expect(page.locator(".sleep-info")).toHaveCount(0);
    await expect(await vloer(page, "Leefruimte")).toHaveText("27,00");
    await expect(await vloer(page, "Slaapkamer")).toHaveText("14,40");
    await page.getByRole("button", { name: "Ongedaan maken" }).click();
    await expect(await vloer(page, "Leefruimte")).toHaveText("26,10");
    expect(fouten).toEqual([]);
  });

  test("te ver slepen: rode melding, laatste geldige stand blijft", async ({ page }) => {
    await start(page);
    await openVoorbeeld(page);
    const s = await schaal(page);
    const c = await midden(page, 'polygon[data-muur="m-binnen"]');
    await muisSleep(page, c, { x: c.x + 5000 * s, y: c.y }, 25);
    await expect(page.locator(".sleep-info.fout")).toContainText(/Zo ver verschuiven|te kort voor/); // beide zijn terechte weigeringen
    await page.mouse.up();
    const slaap = await (await vloer(page, "Slaapkamer")).textContent();
    expect(Number(slaap!.replace(",", "."))).toBeGreaterThan(0);
    expect(Number(slaap!.replace(",", "."))).toBeLessThan(15.3);
  });

  test("raam naar een andere muur slepen; die muur wordt geselecteerd", async ({ page }) => {
    const fouten = await start(page);
    await openVoorbeeld(page);
    const van = await midden(page, 'polygon[data-opening="o-raam-leef"]');
    const naar = await midden(page, 'polygon[data-muur="m-boven-links"]');
    await muisSleep(page, van, naar, 15);
    await expect(page.locator(".sleep-info")).toContainText("raam → Leefruimte — bovenste muur");
    await page.mouse.up();
    await expect(page.locator(".openingen li span").first()).toContainText("raam 2400 × 1500");
    await expect(page.locator(".paneel .uitleg").first()).toContainText("Hartlijn 6000 mm");
    expect(fouten).toEqual([]);
  });

  test("na het slepen werkt een gewone klik nog (regressie)", async ({ page }) => {
    await start(page);
    await openVoorbeeld(page);
    const s = await schaal(page);
    const c = await midden(page, 'polygon[data-muur="m-binnen"]');
    await muisSleep(page, c, { x: c.x + 5000 * s, y: c.y }, 25); // los buiten het plan
    await page.mouse.up();
    await page.locator('polygon[data-muur="m-onder-links"]').first().click({ force: true });
    await expect(page.locator(".paneel h2").first()).toHaveText("Muur");
    // klikken op een raam selecteert zijn muur
    await page.locator('polygon[data-opening="o-raam-slaap"]').first().click({ force: true });
    await expect(page.locator(".openingen li span").first()).toContainText("raam 1600 × 1400");
  });

  test("raam via de keuzelijst naar de tussenmuur", async ({ page }) => {
    await start(page);
    await openVoorbeeld(page);
    await page.locator('polygon[data-muur="m-onder-links"]').first().click({ force: true });
    await page.locator(".openingen li", { hasText: "raam" }).getByRole("button", { name: "Wijzig" }).click();
    await page.locator('select[name="muur"]').selectOption({ label: "Tussenmuur Leefruimte / Slaapkamer · 4500 mm" });
    await page.locator('input[name="afstand"]').fill("500");
    await page.getByRole("button", { name: "Opslaan" }).click();
    await expect(page.locator(".paneel .uitleg").first()).toContainText("dikte 100 mm");
    await expect(page.locator(".openingen li span").first()).toContainText("op 500 mm van A");
  });
});
