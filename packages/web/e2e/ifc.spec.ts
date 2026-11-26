import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openVoorbeeld, start } from "./hulp.ts";

test("IFC (BIM) downloaden", async ({ page }) => {
  const fouten = await start(page);
  await openVoorbeeld(page);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "IFC (BIM)" }).click()]);
  expect(dl.suggestedFilename()).toMatch(/\.ifc$/);
  const inhoud = readFileSync((await dl.path())!, "utf8");
  expect(inhoud).toContain("FILE_SCHEMA(('IFC4'));");
  expect(inhoud).toContain("IFCWALL(");
  expect(fouten).toEqual([]);
});
