import { expect, test } from "@playwright/test";
import { openVoorbeeld } from "./hulp.ts";

test("gsm: na één bezoek opent de app zonder netwerk (werf en keuken)", async ({ browser }) => {
  const ctx = await browser.newContext({ ...test.info().project.use, serviceWorkers: "allow" });
  const page = await ctx.newPage();
  const fouten: string[] = [];
  page.on("pageerror", (e) => fouten.push(e.message));
  await page.goto("/");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).length)).toBeGreaterThan(0);
  await ctx.setOffline(true);
  await page.reload();
  await expect(page.getByText("Offline: de app werkt gewoon verder")).toBeVisible();
  await openVoorbeeld(page);
  for (const m of ["Werf", "Keuken"]) {
    await page.getByRole("tab", { name: m, exact: true }).click();
    await expect(page.locator(".paneel [role=alert]")).toHaveCount(0);
    await expect(page.locator(`.paneel .${m.toLowerCase()}`)).toBeVisible();
  }
  expect(fouten).toEqual([]);
  await ctx.close();
});
