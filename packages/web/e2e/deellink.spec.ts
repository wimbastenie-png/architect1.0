import { expect, test } from "@playwright/test";
import { openVoorbeeld, start } from "./hulp.ts";

test.describe("deellink (gsm ↔ desktop)", () => {
  test("link maken op het ene toestel, openen op het andere", async ({ browser }) => {
    // toestel 1: project maken, hernoemen en delen (geen navigator.share op desktop → klembord)
    const een = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
    const p1 = await een.newPage();
    const fouten = await start(p1);
    await openVoorbeeld(p1);
    const naam = p1.getByLabel("Projectnaam");
    await naam.fill("Werf Kerkstraat 12");
    await naam.blur();
    await p1.getByRole("button", { name: "Delen (link)" }).click();
    await expect(p1.locator(".bevestiging")).toContainText("Link gekopieerd");
    const link = await p1.evaluate(() => navigator.clipboard.readText());
    expect(link).toMatch(/#p=[A-Za-z0-9_-]+$/);
    const muren1 = await p1.locator(".plan svg [data-muur]").count();
    expect(fouten).toEqual([]);

    // toestel 2: leeg; heeft al een ander project → eerst vragen of het vervangen mag
    const twee = await browser.newContext();
    const p2 = await twee.newPage();
    const vragen: string[] = [];
    p2.on("dialog", (d) => { vragen.push(d.message()); void d.accept(); });
    await p2.goto("/");
    await p2.evaluate(() => localStorage.clear());
    await p2.reload();
    await openVoorbeeld(p2);
    await p2.goto(link);
    await expect(p2.locator(".melding.bericht")).toContainText("Project 'Werf Kerkstraat 12' geopend via deellink");
    expect(vragen.join()).toContain("wordt vervangen");
    await expect(p2.getByLabel("Projectnaam")).toHaveValue("Werf Kerkstraat 12");
    expect(await p2.locator(".plan svg [data-muur]").count()).toBe(muren1);
    expect(new URL(p2.url()).hash).toBe(""); // code weg uit de adresbalk
    // na vernieuwen: bewaard op dit toestel, niet opnieuw gevraagd
    await p2.reload();
    await expect(p2.getByLabel("Projectnaam")).toHaveValue("Werf Kerkstraat 12");
    expect(vragen).toHaveLength(1);
    await een.close();
    await twee.close();
  });

  test("beschadigde link: duidelijke melding, niets kapot", async ({ page }) => {
    const fouten = await start(page);
    await page.goto("/#p=dit-is-geen-project");
    await expect(page.locator(".melding[role=alert]")).toContainText("Deze deellink kan niet geopend worden");
    await expect(page.getByRole("button", { name: "Voorbeeld openen" })).toBeVisible();
    expect(fouten).toEqual([]);
  });
});
