import { expect, test, type Page } from "@playwright/test";
import { geenHorizontaleScroll, openVoorbeeld, schaal, start, vloer } from "./hulp.ts";

/** Echte aanraking (touchStart/Move/End) via het Chrome DevTools-protocol. */
async function vingerSleep(page: Page, x: number, y: number, dx: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let i = 1; i <= 10; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + (dx * i) / 10, y }] });
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
});
