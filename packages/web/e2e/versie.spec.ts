import { expect, test } from "@playwright/test";

test("nieuwe versie online → balk met Vernieuwen", async ({ page }) => {
  await page.route("**/versie.json*", (r) => r.fulfill({ json: { versie: "2099-01-01 00:00 · nieuw12" } }));
  await page.goto("/");
  const balk = page.locator(".nieuwe-versie");
  await expect(balk).toContainText("nieuwe versie");
  await page.unroute("**/versie.json*");
  await balk.getByRole("button", { name: "Vernieuwen" }).click();
  await expect(page).toHaveURL(/[?&]v=\d+/);
});

test("zelfde versie → geen balk", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(800);
  await expect(page.locator(".nieuwe-versie")).toHaveCount(0);
});
