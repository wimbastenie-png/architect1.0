import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openVoorbeeld, start } from "./hulp.ts";

async function tik(page: Page, x: number, y: number) {
  const p = await page.evaluate(([px, py]) => {
    const svg = document.querySelector(".plan svg") as SVGSVGElement;
    const q = new DOMPoint(px! - Number(svg.dataset.minX), Number(svg.dataset.maxY) - py!).matrixTransform(svg.getScreenCTM()!);
    return { x: q.x, y: q.y };
  }, [x, y]);
  await page.mouse.click(p.x, p.y);
}

test("keuken: wand kiezen, meten, vullen, kast aanpassen, controle en exports", async ({ page }) => {
  const fouten = await start(page);
  await openVoorbeeld(page);
  await page.getByRole("tab", { name: "Keuken" }).click();
  await tik(page, 3000, 4400); // dicht bij de achterwand van de leefruimte
  await expect(page.locator(".keuken h2")).toContainText("Leefruimte");
  await expect(page.locator(".keuken .soorten button.actief")).toContainText("5800");
  await expect(page.locator(".keuken .aandachtspunten")).toHaveCount(0);
  await page.getByLabel("Lengte bij de vloer").fill("5795");
  await page.getByLabel("Lengte bij het plafond").fill("5788");
  await page.getByRole("button", { name: "Wand vullen (voorstel)" }).click();
  await expect(page.locator(".keuken .aanzicht [data-kast]").first()).toBeVisible();
  await expect(page.locator(".keuken .aandachtspunten")).toContainText("Spoelbak");
  // een kast aanklikken en verschuiven
  const k = await page.evaluate(() => { const r = document.querySelectorAll(".keuken .aanzicht [data-kast]")[2]!.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.click(k.x, k.y);
  await expect(page.getByRole("button", { name: "10 mm naar rechts" })).toBeVisible();
  const x0 = await page.getByLabel("Positie vanaf links").inputValue();
  await page.getByRole("button", { name: "100 mm naar rechts" }).click();
  await expect(page.getByLabel("Positie vanaf links")).toHaveValue(String(+x0 + 100));
  await expect(page.locator(".keuken .aandachtspunten")).toContainText("overlappen");
  const [pdf] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Wandaanzichten (PDF)" }).click()]);
  expect(readFileSync((await pdf.path())!).subarray(0, 4).toString()).toBe("%PDF");
  const [csv] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Kasten- en snijlijst (Excel)" }).click()]);
  expect(readFileSync((await csv.path())!, "utf8")).toContain("Snijlijst: onderdeel");
  const [dxf] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Wandaanzicht (DXF)" }).click()]);
  expect(readFileSync((await dxf.path())!, "utf8")).toContain("KASTEN");
  expect(fouten).toEqual([]);
});
