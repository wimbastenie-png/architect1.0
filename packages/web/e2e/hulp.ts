import { expect, type Page } from "@playwright/test";

/** Lege start: geen bewaard project in de browser. */
export async function start(page: Page) {
  const fouten: string[] = [];
  page.on("pageerror", (e) => fouten.push(e.message));
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  return fouten;
}

export async function openVoorbeeld(page: Page) {
  await page.getByRole("button", { name: "Voorbeeld openen" }).click();
  await expect(page.locator(".plan svg")).toBeVisible();
}

/** Vloeroppervlak van een ruimte in de meetstaat (tekst, bv. "26,10"). */
export async function vloer(page: Page, ruimte: string) {
  const perRuimte = page.getByRole("tab", { name: "Per ruimte" });
  if (await perRuimte.count()) await perRuimte.click();
  return page.locator(".paneel tbody tr", { hasText: ruimte }).first().locator("td").nth(1);
}

/** Pixels per mm in het plan (de svg is in mm getekend). */
export async function schaal(page: Page) {
  return page.evaluate(() => document.querySelector(".plan svg")!.getScreenCTM()!.a);
}

export async function midden(page: Page, selector: string) {
  const bb = (await page.locator(selector).first().boundingBox())!;
  return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
}

/** Muis slepen in kleine stappen (zoals een echte hand). */
export async function muisSleep(page: Page, van: { x: number; y: number }, naar: { x: number; y: number }, stappen = 12) {
  await page.mouse.move(van.x, van.y);
  await page.mouse.down();
  for (let i = 1; i <= stappen; i++) await page.mouse.move(van.x + ((naar.x - van.x) * i) / stappen, van.y + ((naar.y - van.y) * i) / stappen);
}

export async function geenHorizontaleScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
}
