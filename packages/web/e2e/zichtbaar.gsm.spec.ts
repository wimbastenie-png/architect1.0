import { expect, test } from "@playwright/test";

// Op de gsm: alle onderdelen zichtbaar bovenaan, ook na scrollen; versie onderaan.
test("gsm: knoppen Plan … Inrichting altijd volledig zichtbaar", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "Voorbeeld openen" }).click();
  const namen = ["Plan", "Installaties", "Ontwerp", "Liggers", "Inrichting"];
  const binnenBeeld = async () => {
    const b = page.viewportSize()!.width;
    for (const n of namen) {
      const k = await page.getByRole("tab", { name: n, exact: true }).boundingBox();
      expect(k, n).not.toBeNull();
      expect(k!.x).toBeGreaterThanOrEqual(0);
      expect(k!.x + k!.width, n).toBeLessThanOrEqual(b + 1);
      expect(k!.y, n).toBeGreaterThanOrEqual(-1);
      expect(k!.y + k!.height, n).toBeLessThanOrEqual(page.viewportSize()!.height);
    }
  };
  await binnenBeeld();
  await page.mouse.wheel(0, 2000);
  await page.waitForTimeout(300);
  await binnenBeeld(); // na scrollen nog steeds bovenaan
  await page.getByRole("tab", { name: "Inrichting", exact: true }).tap();
  await expect(page.getByRole("heading", { name: "Inrichting" })).toBeVisible();
  await expect(page.locator(".voet")).toContainText("versie");
});
