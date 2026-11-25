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

/** Midden van een element op het scherm. Rechtstreeks in de pagina gemeten: het plan wordt
 *  bij elke wijziging opnieuw getekend, en een locator kan net een verdwenen element vasthebben. */
export async function midden(page: Page, selector: string) {
  await page.locator(selector).first().waitFor();
  return page.evaluate((sel) => {
    const r = document.querySelector(sel)!.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, selector);
}

export async function kader(page: Page, selector: string) {
  await page.locator(selector).first().waitFor();
  return page.evaluate((sel) => {
    const r = document.querySelector(sel)!.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, selector);
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
