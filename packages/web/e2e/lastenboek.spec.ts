import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openVoorbeeld, start, vloer } from "./hulp.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test("codes op het plan, lastenboek kopiëren en exporteren", async ({ page }) => {
  const fouten = await start(page);
  await openVoorbeeld(page);
  const tekst = await page.locator(".plan svg").textContent();
  for (const code of ["D1", "D2 · 830", "R1", "R2"]) expect(tekst).toContain(code);

  await page.getByRole("tab", { name: "Lastenboek" }).click();
  await expect(page.locator(".paneel tbody tr:not(.groep)").first()).toContainText("Vloerafwerking");
  await expect(page.locator(".paneel tbody tr:not(.groep)").first()).toContainText("41,40");
  await page.getByRole("button", { name: "Kopiëren voor offerte" }).click();
  const klembord = await page.evaluate(() => navigator.clipboard.readText());
  expect(klembord.split("\n")[0]).toMatch(/^01\tVloerafwerking\tm²\t41,40/);

  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Lastenboek (Excel)" }).click()]);
  const csv = readFileSync((await dl.path())!, "utf8");
  expect(csv).toContain("01;Vloerafwerking;m²;41,40;");
  expect(csv).not.toMatch(/SUM\(|SOM\(/);
  expect(fouten).toEqual([]);
});

test("verdieping toevoegen, hernoemen, verwijderen en terugzetten", async ({ page }) => {
  const fouten = await start(page);
  await openVoorbeeld(page);
  await page.getByRole("button", { name: "+ Verdieping" }).click();
  await expect(page.getByLabel("Vloerpeil (mm boven ±0)")).toHaveValue("3000");
  await page.getByRole("button", { name: "Verdieping maken" }).click();
  await expect(page.locator(".tabs button.actief")).toContainText("Eerste verdieping");
  await expect(await vloer(page, "Leefruimte (Eerste verdieping)")).toHaveText("26,10");

  await page.getByLabel("Naam verdieping").fill("Verdieping +1");
  await page.getByLabel("Vloerpeil (mm)").fill("2950");
  await page.getByLabel("Vloerpeil (mm)").blur();
  await expect(page.locator(".tabs button").first()).toContainText("Verdieping +1");
  await expect(page.locator(".tabs button").first()).toContainText("+2,95 m");

  await page.getByRole("button", { name: "Verdieping verwijderen" }).click();
  await expect(page.locator(".tabs button")).toHaveCount(2); // Gelijkvloers + "+ Verdieping"
  await page.getByRole("button", { name: "Ongedaan maken" }).click();
  await expect(page.locator(".tabs button")).toHaveCount(3);
  expect(fouten).toEqual([]);
});
