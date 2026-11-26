import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openVoorbeeld } from "./hulp.ts";

async function tik(page: Page, x: number, y: number) {
  await page.locator(".plan").first().scrollIntoViewIfNeeded();
  const p = await page.evaluate(([px, py]) => {
    const svg = document.querySelector(".plan svg") as SVGSVGElement;
    const q = new DOMPoint(px! - Number(svg.dataset.minX), Number(svg.dataset.maxY) - py!).matrixTransform(svg.getScreenCTM()!);
    return { x: q.x, y: q.y };
  }, [x, y]);
  await page.mouse.click(p.x, p.y);
}

test("architect: dak, trap, perceel, nieuwe indeling, meetstaat, opmerking, vergunnings-PDF", async ({ page }) => {
  const fouten: string[] = [];
  page.on("pageerror", (e) => fouten.push(e.message));
  page.on("dialog", (d) => d.accept(d.message().startsWith("Jouw naam") ? "Wim" : "Hier komt de trap"));
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await openVoorbeeld(page);
  await page.getByRole("tab", { name: "Ontwerp" }).click();
  // dak
  await page.getByText(/^Dak \(/).click();
  await page.getByLabel("Soort dak").selectOption("zadel");
  await expect(page.locator(".ontwerp")).toContainText("Nokhoogte: 4,85 m");
  await page.getByLabel("Zijde").selectOption("links");
  await expect(page.locator(".ontwerp .schema").last().locator("polygon")).toHaveCount(2); // topgevel + dak
  // trap
  await page.getByRole("button", { name: "Trap", exact: true }).click();
  await tik(page, 1000, 1000);
  await tik(page, 4000, 1000);
  await expect(page.locator(".plan svg")).toContainText(/\d+ × \d+\/\d+/);
  // perceel
  await page.getByText(/^Terrein en inplanting/).click();
  await page.getByRole("button", { name: "Perceel (rechthoek) instellen" }).click();
  await expect(page.locator(".ontwerp")).toContainText("zijde 1: 6,00 m");
  // tussenmuur afbreken en nieuwe indeling
  await tik(page, 6000, 2000);
  await page.getByRole("button", { name: "Afbreken", exact: true }).click();
  await page.locator("summary", { hasText: "Ruimtes nieuwe toestand" }).click();
  await page.getByRole("button", { name: "Ruimtes nieuwe toestand indelen" }).click();
  await expect(page.locator(".ontwerp")).toContainText("worden één ruimte");
  await page.getByRole("tab", { name: "Nieuwe toestand" }).click();
  await expect(page.locator(".paneel tbody")).toContainText("Leefruimte + Slaapkamer");
  // opmerking
  await page.getByRole("button", { name: "Opmerking", exact: true }).click();
  await tik(page, 2000, 3000);
  await expect(page.locator(".plan svg [data-opmerking]")).toHaveCount(1);
  await expect(page.locator(".opmerkingen")).toContainText("Hier komt de trap");
  await expect(page.locator(".opmerkingen")).toContainText("Wim");
  // vergunnings-PDF
  const [pdf] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Vergunningsklare basis (PDF)" }).click()]);
  expect(readFileSync((await pdf.path())!).subarray(0, 4).toString()).toBe("%PDF");
  // opmerking blijft zichtbaar in de gewone planweergave
  await page.getByRole("tab", { name: "Plan" }).click();
  await expect(page.locator(".plan svg [data-opmerking]")).toHaveCount(1);
  expect(fouten).toEqual([]);
});
