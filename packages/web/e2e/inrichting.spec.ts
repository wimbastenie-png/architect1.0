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

test("inrichting: bed plaatsen en draaien, materialen, opmerking, 3D met PNG en GLB", async ({ page }) => {
  const fouten = await start(page);
  await openVoorbeeld(page);
  await page.getByRole("tab", { name: "Inrichting" }).click();
  await page.getByRole("tab", { name: "Slapen" }).click();
  await page.getByRole("button", { name: "Tweepersoonsbed 160 × 200" }).click();
  await tik(page, 7900, 2300);
  await expect(page.locator(".plan svg polygon[data-meubel]")).toHaveCount(1);
  await page.getByRole("button", { name: "Tweepersoonsbed 160 × 200" }).click(); // plaatsen uit
  await page.getByRole("button", { name: "Draai 90 graden" }).click();
  await expect(page.locator(".inrichting .aandachtspunten")).toHaveCount(0);
  // kast in de tussenmuur → opmerking
  await page.getByRole("tab", { name: "Wonen" }).click();
  await page.getByRole("button", { name: "Boekenkast", exact: true }).click();
  await tik(page, 6000, 1500);
  await page.getByRole("button", { name: "Boekenkast", exact: true }).click();
  await expect(page.locator(".inrichting .aandachtspunten")).toContainText("steekt in een muur");
  // materialen van de leefruimte
  await tik(page, 2500, 2500);
  await page.getByLabel("Vloer").selectOption("parket-eik");
  await page.getByLabel("Wanden").selectOption("salie");
  // 3D
  await page.getByRole("button", { name: "3D bekijken" }).click();
  const canvas = page.locator(".drie3d-beeld canvas");
  await expect(canvas).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(500);
  const kleuren = await canvas.evaluate((c: HTMLCanvasElement) => {
    const t = document.createElement("canvas"); t.width = 64; t.height = 64;
    const x = t.getContext("2d")!; x.drawImage(c, 0, 0, 64, 64);
    const d = x.getImageData(0, 0, 64, 64).data; const s = new Set<string>();
    for (let i = 0; i < d.length; i += 4) s.add(`${d[i]! >> 4},${d[i + 1]! >> 4},${d[i + 2]! >> 4}`);
    return s.size;
  });
  expect(kleuren).toBeGreaterThan(8); // er is iets getekend (niet één effen kleur)
  const [png] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Beeld bewaren (PNG)" }).click()]);
  expect(readFileSync((await png.path())!).subarray(1, 4).toString()).toBe("PNG");
  const [glb] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "3D-bestand (GLB)" }).click()]);
  expect(readFileSync((await glb.path())!).subarray(0, 4).toString()).toBe("glTF");
  await page.getByRole("dialog").getByRole("button", { name: "Sluiten" }).click();
  expect(fouten).toEqual([]);
});
