import { expect, test } from "@playwright/test";
import { openVoorbeeld } from "./hulp.ts";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("offline: na één bezoek opent de app zonder netwerk, met alle modi", async ({ browser }) => {
  const ctx = await browser.newContext({ serviceWorkers: "allow" });
  const page = await ctx.newPage();
  const fouten: string[] = [];
  page.on("pageerror", (e) => fouten.push(e.message));
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).some((k) => k.startsWith("architect1.0 ")))).toBe(true);
  // installeerbaar: manifest met iconen
  const manifest = await page.evaluate(async () => (await fetch(document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!.href)).json());
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toContain("512x512");

  await ctx.setOffline(true);
  await page.reload();
  await expect(page.getByText("Offline: de app werkt gewoon verder")).toBeVisible();
  await openVoorbeeld(page);
  for (const m of ["Installaties", "Ontwerp", "Liggers", "Inrichting", "Energie", "Keuken", "Werf"]) {
    await page.getByRole("tab", { name: m, exact: true }).click();
    await expect(page.locator(".paneel .laden")).toHaveCount(0);
    await expect(page.locator(".paneel .kaart").first()).toBeVisible();
  }
  // PDF-maker komt ook uit de bewaarde app
  await page.getByRole("tab", { name: "Plan", exact: true }).click();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF-plan" }).click();
  expect((await dl).suggestedFilename()).toMatch(/\.pdf$/);
  expect(fouten).toEqual([]);
  await ctx.close();
});

test("offline: wijzigingen en foto's wachten en gaan mee zodra er weer netwerk is", async ({ browser }) => {
  const ctx = await browser.newContext({ serviceWorkers: "allow" });
  const page = await ctx.newPage();
  const fouten: string[] = [];
  page.on("pageerror", (e) => fouten.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") fouten.push(m.text()); });
  page.on("dialog", (d) => d.accept());
  await page.goto("/?cloud-demo");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/?cloud-demo");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await openVoorbeeld(page);
  await page.getByRole("button", { name: /^Cloud/ }).click();
  await page.getByLabel("E-mailadres").fill("an@voorbeeld.be");
  await page.getByRole("button", { name: "Aanmelden" }).click();
  await page.getByRole("button", { name: "Bewaren in de cloud" }).click();
  await page.getByRole("button", { name: "Sluiten" }).click();
  await expect(page.getByRole("button", { name: /Cloud: bewaard/ })).toBeVisible();
  const cloudVersie = () => page.evaluate(() => (Object.values(JSON.parse(localStorage.getItem("architect1.0:cloud-demo")!).projecten)[0] as { versie: number; naam: string }));

  // geen netwerk: naam wijzigen en een werffoto nemen
  await ctx.setOffline(true);
  await page.getByLabel("Projectnaam").fill("Werf offline");
  await page.getByLabel("Projectnaam").blur();
  await expect(page.getByRole("button", { name: "Offline: wijzigingen wachten" })).toBeVisible({ timeout: 10000 });
  await page.getByRole("tab", { name: "Werf", exact: true }).click();
  await page.locator('.werf input[type="file"]').first().setInputFiles({ name: "werf.png", mimeType: "image/png", buffer: PNG });
  await expect(page.locator(".werf .duim img")).toHaveCount(1);
  await page.waitForTimeout(2500);
  expect((await cloudVersie()).versie).toBe(1);

  // netwerk terug: alles gaat vanzelf mee
  await ctx.setOffline(false);
  await expect(page.getByRole("button", { name: /Cloud: bewaard/ })).toBeVisible({ timeout: 10000 });
  await expect.poll(async () => (await cloudVersie()).naam, { timeout: 10000 }).toBe("Werf offline");
  const fotoInCloud = () => page.evaluate(() => new Promise<number>((ok) => { const r = indexedDB.open("architect1.0-cloud-demo-fotos", 1); r.onupgradeneeded = () => r.result.createObjectStore("fotos"); r.onsuccess = () => { const q = r.result.transaction("fotos").objectStore("fotos").count(); q.onsuccess = () => ok(q.result); }; }));
  await expect.poll(fotoInCloud, { timeout: 10000 }).toBe(1);

  // ander toestel (hier: foto lokaal weg): de foto komt uit de cloud
  await page.evaluate(() => new Promise<void>((ok) => { const r = indexedDB.open("architect1.0-fotos", 2); r.onsuccess = () => { const t = r.result.transaction("fotos", "readwrite"); t.objectStore("fotos").clear(); t.oncomplete = () => ok(); }; }));
  await page.reload();
  await page.getByRole("tab", { name: "Werf", exact: true }).click();
  await expect(page.locator(".werf .duim img")).toHaveCount(1);
  expect(fouten).toEqual([]);
  await ctx.close();
});
