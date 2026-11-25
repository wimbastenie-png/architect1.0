import { expect, test, type Page } from "@playwright/test";
import { geenHorizontaleScroll, openVoorbeeld, schaal, start, vloer } from "./hulp.ts";

/** Echte aanraking (touchStart/Move/End) via het Chrome DevTools-protocol. */
async function vingerSleep(page: Page, x: number, y: number, dx: number, dy = 0) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let i = 1; i <= 10; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + (dx * i) / 10, y: y + (dy * i) / 10 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

test.describe("gsm (Android)", () => {
  test("geen horizontale scroll, ook met lastenboek en muurpaneel", async ({ page }) => {
    const fouten = await start(page);
    await openVoorbeeld(page);
    await geenHorizontaleScroll(page);
    await page.getByRole("tab", { name: "Lastenboek" }).click();
    await geenHorizontaleScroll(page);
    await page.locator('[data-muur="m-binnen"]').first().tap({ force: true });
    await geenHorizontaleScroll(page);
    expect(fouten).toEqual([]);
  });

  test("vinger: niet-aangetikte muur blijft staan, aangetikte muur verschuift", async ({ page }) => {
    const fouten = await start(page);
    await openVoorbeeld(page);
    const s = await schaal(page);
    let bb = (await page.locator('polygon[data-muur="m-binnen"]').first().boundingBox())!;
    await vingerSleep(page, bb.x + bb.width / 2, bb.y + bb.height / 2, 200 * s);
    await expect(await vloer(page, "Leefruimte")).toHaveText("26,10");

    await page.locator('polygon[data-muur="m-binnen"]').first().tap({ force: true });
    bb = (await page.locator('polygon[data-muur="m-binnen"]').first().boundingBox())!;
    await vingerSleep(page, bb.x + bb.width / 2, bb.y + bb.height / 2, 200 * s);
    await expect(await vloer(page, "Leefruimte")).toHaveText("27,00");
    expect(fouten).toEqual([]);
  });

  test("vinger: hoek van een aangetikte muur slepen maakt ze schuin", async ({ page }) => {
    const fouten = await start(page);
    await openVoorbeeld(page);
    await page.locator('polygon[data-muur="m-rechts"]').first().tap({ force: true });
    const s = await schaal(page);
    const bb = (await page.locator('circle[data-hoek="9600,4800"]').first().boundingBox())!;
    await vingerSleep(page, bb.x + bb.width / 2, bb.y + bb.height / 2, 500 * s);
    const slaap = Number((await (await vloer(page, "Slaapkamer")).textContent())!.replace(",", "."));
    expect(slaap).toBeGreaterThan(15.3); // hoek rechtsboven 500 mm naar rechts: slaapkamer groter
    expect(fouten).toEqual([]);
  });

  test("onnauwkeurige vinger: muur en hoek raken ook naast het midden", async ({ page }) => {
    const fouten = await start(page);
    await openVoorbeeld(page);
    await page.evaluate(() => window.scrollTo(0, 0)); // plan in beeld, zoals op de gsm
    // een muur is op een gsm maar ± 8 px dik: tik 12 px ernaast
    const m = (await page.locator('polygon[data-muur="m-rechts"]').first().boundingBox())!;
    await page.touchscreen.tap(m.x + m.width / 2 - 12, m.y + m.height / 2);
    await expect(page.locator(".paneel h2").first()).toHaveText("Muur");
    // hoek B slepen vanaf 14 px naast het midden van het rondje
    const s = await schaal(page);
    const c = (await page.locator('circle[data-hoek="9600,4800"]').first().boundingBox())!;
    await vingerSleep(page, c.x + c.width / 2 + 10, c.y + c.height / 2 + 10, 500 * s);
    const slaap = Number((await (await vloer(page, "Slaapkamer")).textContent())!.replace(",", "."));
    expect(slaap).toBeGreaterThan(15.3);
    // de muur blijft geselecteerd na het slepen van de hoek
    await expect(page.locator(".paneel h2").first()).toHaveText("Muur");
    expect(fouten).toEqual([]);
  });

  test("aanraakzones zijn minstens 40 px groot op het scherm", async ({ page }) => {
    await start(page);
    await openVoorbeeld(page);
    await page.locator('polygon[data-muur="m-rechts"]').first().tap({ force: true });
    const hoek = (await page.locator('circle[data-hoek="9600,4800"]').last().boundingBox())!;
    expect(hoek.width).toBeGreaterThanOrEqual(40);
    const breedte = await page.evaluate(() => {
      const l = document.querySelector('line[data-raak][data-muur="m-binnen"]') as SVGLineElement;
      return Number(l.getAttribute("stroke-width")) * document.querySelector(".plan svg")!.getScreenCTM()!.a;
    });
    expect(breedte).toBeGreaterThanOrEqual(40);
  });
});

