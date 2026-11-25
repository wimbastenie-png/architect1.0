import { expect, test, type Page } from "@playwright/test";
import { geenHorizontaleScroll, openVoorbeeld, schaal, start, vloer } from "./hulp.ts";

/**
 * Echte aanraking (touchStart/Move/End) via het Chrome DevTools-protocol.
 * `vasthouden` ms stil blijven vóór het slepen (ingedrukt houden); 0 = meteen vegen.
 */
async function vingerSleep(page: Page, x: number, y: number, dx: number, dy = 0, vasthouden = 600) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  if (vasthouden) await page.waitForTimeout(vasthouden);
  for (let i = 1; i <= 10; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + (dx * i) / 10, y: y + (dy * i) / 10 }] });
    await page.waitForTimeout(20); // ± een beeldverversing per stap
  }
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

  test("vinger: vegen verschuift niets, ingedrukt houden en slepen wel", async ({ page }) => {
    const fouten = await start(page);
    await openVoorbeeld(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    const s = await schaal(page);
    let bb = (await page.locator('polygon[data-muur="m-binnen"]').first().boundingBox())!;
    // Afstanden realistisch voor een vinger: op een Pixel 7 is 1 mm ± 0,03 px, en Chrome negeert
    // bewegingen binnen ± 15 px ("slop"). 800 mm ≈ 22 px.
    await vingerSleep(page, bb.x + bb.width / 2, bb.y + bb.height / 2, 800 * s, 0, 0); // meteen vegen
    await expect(await vloer(page, "Leefruimte")).toHaveText("26,10");

    await page.evaluate(() => window.scrollTo(0, 0));
    bb = (await page.locator('polygon[data-muur="m-binnen"]').first().boundingBox())!;
    await vingerSleep(page, bb.x + bb.width / 2, bb.y + bb.height / 2, 800 * s); // eerst ingedrukt houden
    await expect(await vloer(page, "Leefruimte")).toHaveText("29,70"); // 6600 × 4500
    await expect(await vloer(page, "Slaapkamer")).toHaveText("11,70"); // 2600 × 4500
    // na het slepen is de muur geselecteerd; één keer ongedaan maken zet alles terug
    await expect(page.locator(".paneel h2").first()).toHaveText("Muur");
    await page.getByRole("button", { name: "Ongedaan maken" }).click();
    await expect(await vloer(page, "Leefruimte")).toHaveText("26,10");
    expect(fouten).toEqual([]);
  });

  test("vinger: raam ingedrukt houden en naar een andere muur slepen", async ({ page }) => {
    const fouten = await start(page);
    await openVoorbeeld(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    const van = (await page.locator('polygon[data-opening="o-raam-leef"]').first().boundingBox())!;
    const naar = (await page.locator('polygon[data-muur="m-boven-links"]').first().boundingBox())!;
    const x = van.x + van.width / 2, y = van.y + van.height / 2;
    await vingerSleep(page, x, y, naar.x + naar.width / 2 - x, naar.y + naar.height / 2 - y);
    await expect(page.locator(".openingen li span").first()).toContainText("raam 2400 × 1500");
    await expect(page.locator(".paneel .uitleg").first()).toContainText("Hartlijn 6000 mm");
    expect(fouten).toEqual([]);
  });

  test("vinger: tijdens het slepen scrolt de pagina niet", async ({ page }) => {
    const fouten = await start(page);
    // rechthoekige ruimte: de bovenmuur is één stuk en kan omhoog verschuiven
    await page.getByLabel("Projectnaam").fill("Kamer");
    await page.getByLabel("Binnenbreedte (mm)").fill("4000");
    await page.getByLabel("Binnendiepte (mm)").fill("3000");
    await page.getByLabel("Muurdikte (mm)").fill("200");
    await page.getByRole("button", { name: "Plan maken" }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBe(true); // pagina kan scrollen
    const s = await schaal(page);
    const bb = (await page.locator('polygon[data-muur="m-boven"]').first().boundingBox())!;
    // vinger 1000 mm omhoog: zonder blokkering zou de pagina mee scrollen
    await vingerSleep(page, bb.x + bb.width / 2, bb.y + bb.height / 2, 0, -1000 * s);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(await vloer(page, "Leefruimte")).toHaveText("16,00"); // 4000 × 4000
    expect(fouten).toEqual([]);
  });

  test("vinger: hoek van een aangetikte muur ingedrukt houden en slepen maakt ze schuin", async ({ page }) => {
    const fouten = await start(page);
    await openVoorbeeld(page);
    await page.locator('polygon[data-muur="m-rechts"]').first().tap({ force: true });
    await page.evaluate(() => window.scrollTo(0, 0));
    const s = await schaal(page);
    const bb = (await page.locator('circle[data-hoek="9600,4800"]').first().boundingBox())!;
    await vingerSleep(page, bb.x + bb.width / 2, bb.y + bb.height / 2, 1500 * s);
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
    await vingerSleep(page, c.x + c.width / 2 + 10, c.y + c.height / 2 + 10, 1500 * s);
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

