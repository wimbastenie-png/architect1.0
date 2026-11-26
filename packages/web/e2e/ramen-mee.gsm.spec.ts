import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { kader, schaal, vloer } from "./hulp.ts";

// Situatie van de melding: schuine linkermuur, raam R1 dicht bij hoek B (rechtgezet bij het openen).
const stuk = readFileSync(fileURLToPath(new URL("./fixtures/stuk-vorige-versie.json", import.meta.url)), "utf8");

async function vingerSleep(page: Page, x: number, y: number, dx: number, dy = 0) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await page.waitForTimeout(600); // ingedrukt houden
  for (let i = 1; i <= 10; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + (dx * i) / 10, y: y + (dy * i) / 10 }] });
    await page.waitForTimeout(25);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function hoekB(page: Page) {
  await page.goto("/");
  await page.evaluate((json) => localStorage.setItem("architect1.0:project", json), stuk);
  await page.reload();
  await page.locator('polygon[data-muur="m-links"]').first().tap({ force: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  const c = await kader(page, 'circle[data-hoek="1235,160"]');
  return { x: c.x + c.width / 2, y: c.y + c.height / 2, s: await schaal(page) };
}

test.describe("ramen schuiven mee, meldingen leesbaar (gsm)", () => {
  test("hoek B een stuk verder: lukt, raam schuift mee", async ({ page }) => {
    const fouten: string[] = [];
    page.on("pageerror", (e) => fouten.push(e.message));
    const h = await hoekB(page);
    const voor = await (await vloer(page, "Leefruimte")).textContent();
    await page.evaluate(() => window.scrollTo(0, 0));
    await vingerSleep(page, h.x, h.y, 1000 * h.s); // ± 26 px: boven de 15 px die Chrome negeert
    await expect(await vloer(page, "Leefruimte")).not.toHaveText(voor!);
    await expect(page.locator(".sleep-info.fout")).toHaveCount(0);
    expect(fouten).toEqual([]);
  });

  test("te ver: melding volledig leesbaar, en blijft na het loslaten nog even staan", async ({ page }) => {
    const h = await hoekB(page);
    await vingerSleep(page, h.x, h.y, 2600 * h.s);
    const m = page.locator(".sleep-info.fout");
    await expect(m).toContainText("Maak het raam smaller of sleep minder ver"); // ook na het loslaten nog zichtbaar
    // niet afgeknipt: de tekst past in het kader (meerdere regels)
    expect(await m.evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    await expect(m).toHaveCount(0, { timeout: 7000 }); // verdwijnt na ± 5 s
  });
});
