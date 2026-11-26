import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openVoorbeeld, start } from "./hulp.ts";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function tik(page: Page, x: number, y: number) {
  await page.locator(".plan").first().scrollIntoViewIfNeeded();
  const p = await page.evaluate(([px, py]) => {
    const svg = document.querySelector(".plan svg") as SVGSVGElement;
    const q = new DOMPoint(px! - Number(svg.dataset.minX), Number(svg.dataset.maxY) - py!).matrixTransform(svg.getScreenCTM()!);
    return { x: q.x, y: q.y };
  }, [x, y]);
  await page.mouse.click(p.x, p.y);
}

test("werf: foto per ruimte, opvolgpunt, vorderingsstaat en offerte", async ({ page }) => {
  const fouten = await start(page);
  await openVoorbeeld(page);
  // prijzen in het lastenboek
  await page.getByRole("tab", { name: "Lastenboek" }).click();
  await page.getByLabel("Prijs Vloerafwerking").fill("50");
  await page.getByLabel("Prijs Vloerafwerking").blur();
  await page.getByRole("tab", { name: "Werf" }).click();
  await tik(page, 2500, 2500);
  await expect(page.locator(".werf h2")).toContainText("Leefruimte");
  await page.locator('.werf input[type="file"]').first().setInputFiles({ name: "werf.png", mimeType: "image/png", buffer: PNG });
  await expect(page.locator(".werf .duim")).toHaveCount(1);
  await page.getByLabel("Nieuw punt").fill("Stopcontact verplaatsen");
  await page.getByRole("button", { name: "+ Punt" }).click();
  await expect(page.locator(".opvolging")).toContainText("Stopcontact verplaatsen");
  await page.locator(".opvolging input[type=checkbox]").check();
  await expect(page.locator(".opvolging li.klaar")).toHaveCount(1);
  // vorderingsstaat
  await page.getByRole("button", { name: "Eerste vorderingsstaat beginnen" }).click();
  await page.getByLabel("Percentage Vloerafwerking").fill("50");
  await expect(page.locator(".werf")).toContainText("€ 1.035,00"); // 41,40 m² × € 50 × 50 %
  const [vs] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Vorderingsstaat (PDF)" }).click()]);
  expect(readFileSync((await vs.path())!).subarray(0, 4).toString()).toBe("%PDF");
  // offerte
  await page.getByText("Firmagegevens en logo").click();
  await page.getByLabel("Firmanaam").fill("Bouwbedrijf Voorbeeld");
  await page.getByLabel("Klant", { exact: true }).fill("Familie Peeters");
  await page.locator(".werf select").filter({ has: page.locator("option[value=\"6\"]") }).selectOption("6");
  await expect(page.locator(".werf")).toContainText("Verlaagd btw-tarief van 6 %");
  const [of] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Offerte (PDF)" }).click()]);
  expect(readFileSync((await of.path())!).subarray(0, 4).toString()).toBe("%PDF");
  expect(fouten).toEqual([]);
});

test("laser (Leica DISTO, nagebootst): meting komt in het actieve maatveld", async ({ page }) => {
  await page.addInitScript(() => {
    let luisteraar: ((e: unknown) => void) | null = null;
    const kar = {
      addEventListener: (_: string, f: (e: unknown) => void) => { luisteraar = f; },
      startNotifications: async () => kar,
    };
    (window as unknown as { __meet: (m: number) => void }).__meet = (m: number) => {
      const dv = new DataView(new ArrayBuffer(4)); dv.setFloat32(0, m, true);
      luisteraar?.({ target: { value: dv } });
    };
    Object.defineProperty(navigator, "bluetooth", { value: {
      requestDevice: async () => ({ addEventListener: () => {}, gatt: { connect: async () => ({ getPrimaryService: async () => ({ getCharacteristic: async () => kar }) }), disconnect: () => {} } }),
    } });
  });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "Laser" }).click();
  await page.getByRole("button", { name: "Verbinden" }).click();
  await expect(page.getByRole("button", { name: /Laser ✓/ })).toBeVisible();
  await page.getByLabel("Binnenbreedte (mm)").click();
  await page.evaluate(() => (window as unknown as { __meet: (m: number) => void }).__meet(3.215));
  await expect(page.getByLabel("Binnenbreedte (mm)")).toHaveValue("3215");
  await expect(page.getByRole("button", { name: /Laser ✓ 3215 mm/ })).toBeVisible();
});

test("laser: zonder Web Bluetooth een duidelijke uitleg", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, "bluetooth", { value: undefined }); });
  await page.goto("/");
  await page.getByRole("button", { name: "Laser" }).click();
  await expect(page.getByRole("dialog", { name: "Laserafstandsmeter" })).toContainText("Chrome op Android");
});
