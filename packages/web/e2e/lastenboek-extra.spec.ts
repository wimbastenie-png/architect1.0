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

test("lastenboek: afbraak en ruwbouw uit het ontwerp, met prijs, in Excel en PDF", async ({ page }) => {
  const fouten = await start(page);
  await openVoorbeeld(page);
  await page.getByRole("tab", { name: "Ontwerp" }).click();
  await tik(page, 6000, 1500);
  await page.getByRole("button", { name: "Afbreken", exact: true }).click();
  await page.getByRole("button", { name: "Nieuwe muur" }).click();
  await tik(page, 3000, 300);
  await tik(page, 3030, 4500);
  await page.getByRole("tab", { name: "Plan" }).click();
  await page.getByRole("tab", { name: "Lastenboek" }).click();
  const tabel = page.locator("table.lastenboek");
  await expect(tabel.locator("tr.groep")).toContainText(["Afwerking", "Afbraak", "Ruwbouw"]);
  await expect(tabel).toContainText("A01 Afbreken muren");
  await expect(tabel).toContainText("A07 Stutten");
  await expect(tabel).toContainText("Metselwerk nieuwe muren, dikte 100 mm");
  await page.getByLabel("Prijs Afbreken muren").fill("45");
  await page.getByLabel("Prijs Afbreken muren").blur();
  await expect(tabel.locator("tr", { hasText: "A01 Afbreken muren" })).toContainText("€ 504,00");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Lastenboek (Excel)" }).click()]);
  const csv = readFileSync((await dl.path())!, "utf8");
  expect(csv).toContain("A01;Afbreken muren;m²;11,20;45,00;");
  expect(csv).toContain("vakman controleert en tekent af");
  const [pdf] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "PDF-plan" }).click()]);
  expect(readFileSync((await pdf.path())!).subarray(0, 4).toString()).toBe("%PDF");
  await expect(page.locator(".voet")).toContainText("vakman controleert en tekent af");
  expect(fouten).toEqual([]);
});
