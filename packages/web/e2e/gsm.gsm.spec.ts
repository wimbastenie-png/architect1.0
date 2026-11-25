import { expect, test, type Page } from "@playwright/test";
import { geenHorizontaleScroll, kader, openVoorbeeld, schaal, start, vloer } from "./hulp.ts";

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

  test("knijpen met twee vingers zoomt het plan, niet de pagina; daarna fijn slepen", async ({ page }) => {
    const fouten = await start(page);
    await openVoorbeeld(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    const s0 = await schaal(page);
    // knijpen rond de tussenmuur, zodat die na het inzoomen in beeld blijft
    const c = (await page.locator('polygon[data-muur="m-binnen"]').first().boundingBox())!;
    const mx = c.x + c.width / 2, my = c.y + c.height / 2;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: mx - 20, y: my, id: 1 }, { x: mx + 20, y: my, id: 2 }] });
    for (let i = 1; i <= 10; i++) {
      const d = 20 + 6 * i; // vingers 40 px → 160 px uit elkaar: ± ×4
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: mx - d, y: my, id: 1 }, { x: mx + d, y: my, id: 2 }] });
      await page.waitForTimeout(20);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    const s1 = await schaal(page);
    expect(s1 / s0).toBeGreaterThan(3);
    expect(s1 / s0).toBeLessThan(5);
    expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1); // pagina zelf niet ingezoomd
    await expect(page.getByRole("button", { name: /Passend ×/ })).toBeVisible();

    // ingezoomd: 200 mm is nu ± 22 px (uitgezoomd maar 5,6 px: te weinig voor een vinger)
    const bb = (await page.locator('polygon[data-muur="m-binnen"]').first().boundingBox())!;
    await vingerSleep(page, bb.x + bb.width / 2, bb.y + bb.height / 2, 200 * s1);
    await expect(await vloer(page, "Leefruimte")).toHaveText("27,00");
    expect(fouten).toEqual([]);
  });

  test.describe("ingezoomd verschuiven", () => {
    const minX = (page: Page) => page.evaluate(() => Number((document.querySelector(".plan svg") as SVGSVGElement).dataset.minX));
    async function veeg(page: Page, punten: Array<[number, number]>, dx: number, dy: number, vasthouden = 0) {
      const cdp = await page.context().newCDPSession(page);
      const pt = (k: number) => punten.map(([x, y], i) => ({ x: x + (dx * k) / 10, y: y + (dy * k) / 10, id: i + 1 }));
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(0) });
      if (vasthouden) await page.waitForTimeout(vasthouden);
      for (let k = 1; k <= 10; k++) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(k) });
        await page.waitForTimeout(20);
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
    async function ingezoomd(page: Page) {
      await start(page);
      await openVoorbeeld(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Inzoomen" }).click();
      const b = await kader(page, ".plan svg");
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    }

    test("één vinger verschuift het beeld, de pagina scrolt niet", async ({ page }) => {
      const m = await ingezoomd(page);
      const x0 = await minX(page);
      await veeg(page, [[m.x, m.y]], -120, 0);
      expect(await minX(page)).toBeGreaterThan(x0 + 500); // vinger naar links = verder naar rechts in het plan
      const y0 = await page.evaluate(() => Number((document.querySelector(".plan svg") as SVGSVGElement).dataset.maxY));
      await veeg(page, [[m.x, m.y]], 0, 120); // vinger naar beneden: beeld schuift, pagina niet
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      expect(await page.evaluate(() => Number((document.querySelector(".plan svg") as SVGSVGElement).dataset.maxY))).toBeGreaterThan(y0);
    });

    test("twee vingers verschuiven het beeld", async ({ page }) => {
      const m = await ingezoomd(page);
      const x0 = await minX(page);
      await veeg(page, [[m.x - 30, m.y], [m.x + 30, m.y]], -120, 0);
      expect(await minX(page)).toBeGreaterThan(x0 + 500);
    });

    test("ingedrukt houden op een muur sleept de muur, niet het beeld", async ({ page }) => {
      const fouten = await start(page);
      await openVoorbeeld(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Inzoomen" }).click();
      // muur in beeld brengen: m-binnen ligt rechts van het midden
      const s = await schaal(page);
      const bb = await kader(page, 'polygon[data-muur="m-binnen"]');
      const svg = await kader(page, ".plan svg");
      const x = Math.min(bb.x + bb.width / 2, svg.x + svg.width - 20), y = svg.y + svg.height / 2;
      const x0 = await minX(page);
      await veeg(page, [[x, y]], 200 * s, 0, 600);
      expect(await minX(page)).toBe(x0); // beeld niet verschoven
      await expect(await vloer(page, "Leefruimte")).toHaveText("27,00");
      expect(fouten).toEqual([]);
    });

    test("niet ingezoomd: één vinger scrolt de pagina zoals vroeger", async ({ page }) => {
      await start(page);
      await openVoorbeeld(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      const b = await kader(page, ".plan svg");
      await veeg(page, [[b.x + b.width / 2, b.y + b.height / 2]], 0, -150);
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(50);
    });
  });
});

