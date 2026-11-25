import { expect, test, type Page } from "@playwright/test";
import { midden, muisSleep, openVoorbeeld, schaal, start, vloer } from "./hulp.ts";

const minX = (page: Page) => page.evaluate(() => Number((document.querySelector(".plan svg") as SVGSVGElement).dataset.minX));
const viewBox = (page: Page) => page.evaluate(() => document.querySelector(".plan svg")!.getAttribute("viewBox")!.split(" ").map(Number));

test.describe("inzoomen (pc)", () => {
  test("knoppen + en Passend", async ({ page }) => {
    const fouten = await start(page);
    await openVoorbeeld(page);
    const [, , w0, h0] = await viewBox(page);
    await expect(page.getByRole("button", { name: /Passend/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Inzoomen" }).click();
    const [, , w1, h1] = await viewBox(page);
    expect(w1).toBeCloseTo(w0! / 1.5, 0);
    expect(h1! / w1!).toBeCloseTo(h0! / w0!, 3); // zelfde verhouding: tekening springt niet
    await expect(page.getByRole("button", { name: "Passend ×1,5" })).toBeVisible();
    await page.getByRole("button", { name: /Passend/ }).click();
    expect((await viewBox(page))[2]).toBeCloseTo(w0!, 0);
    expect(fouten).toEqual([]);
  });

  test("Ctrl + muiswiel zoomt, gewoon wiel niet", async ({ page }) => {
    await start(page);
    await openVoorbeeld(page);
    const [, , w0] = await viewBox(page);
    const c = await midden(page, '[data-ruimte="r-leef"]');
    await page.mouse.move(c.x, c.y);
    await page.mouse.wheel(0, -200);
    expect((await viewBox(page))[2]).toBeCloseTo(w0!, 0);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -200);
    await page.keyboard.up("Control");
    expect((await viewBox(page))[2]).toBeLessThan(w0! * 0.8);
  });

  test("ingezoomd: beeld verschuiven door op een ruimte te slepen; klikken selecteert nog", async ({ page }) => {
    await start(page);
    await openVoorbeeld(page);
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Inzoomen" }).click();
    const x0 = await minX(page);
    const c = await midden(page, ".plan svg");
    await muisSleep(page, c, { x: c.x - 150, y: c.y });
    await page.mouse.up();
    const x1 = await minX(page);
    expect(x1).toBeGreaterThan(x0); // naar links slepen = beeld schuift naar rechts in het plan
    await expect(page.locator(".paneel h2").first()).toHaveText("Project"); // verschuiven selecteert niets
    // klikken op wat nu midden in beeld ligt (ingezoomd ligt niet elke ruimte nog in beeld)
    const svgBox = (await page.locator(".plan svg").boundingBox())!;
    await page.mouse.click(svgBox.x + svgBox.width / 2, svgBox.y + svgBox.height / 2);
    await expect(page.locator(".paneel h2").first()).toHaveText(/Ruimte|Muur/);
  });

  test("ingezoomd een muur slepen", async ({ page }) => {
    const fouten = await start(page);
    await openVoorbeeld(page);
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Inzoomen" }).click();
    const s = await schaal(page);
    const c = await midden(page, 'polygon[data-muur="m-binnen"]');
    await muisSleep(page, c, { x: c.x + 200 * s, y: c.y });
    await page.mouse.up();
    await expect(await vloer(page, "Leefruimte")).toHaveText("27,00");
    expect(fouten).toEqual([]);
  });
});
