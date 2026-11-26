import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { start, vloer } from "./hulp.ts";

// Kunstmatige RoomPlan-scan (zelfde opbouw als Apple's CapturedRoom-JSON): kamer 4200 × 3400, gedraaid, met deur en raam.
const pad = fileURLToPath(new URL("./fixtures/roomplan-slaapkamer.json", import.meta.url));

test("RoomPlan-scan openen wordt een plan", async ({ page }) => {
  const fouten = await start(page);
  await page.locator('input[type="file"]').setInputFiles(pad);
  await expect(page.locator(".melding.bericht")).toContainText("RoomPlan-scan omgezet");
  await expect(page.locator(".plan svg")).toBeVisible();
  await expect(await vloer(page, "Ruimte 1")).toHaveText("14,28");
  const ids = await page.locator(".plan svg [data-opening]").evaluateAll((els) => new Set(els.map((e) => e.getAttribute("data-opening"))).size);
  expect(ids).toBe(2); // deur en raam
  expect(fouten).toEqual([]);
});
