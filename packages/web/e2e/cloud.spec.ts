import { expect, test, type Page } from "@playwright/test";
import { openVoorbeeld } from "./hulp.ts";

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (payload: unknown) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.handtekening`;

async function leeg(page: Page, pad = "/") {
  await page.goto(pad);
  await page.evaluate(() => localStorage.clear());
  await page.goto(pad);
}

test("demo-cloud: bewaren, op een ander toestel openen, wijziging komt terug, conflict kiezen", async ({ browser }) => {
  // toestel A
  const a = await (await browser.newContext()).newPage();
  const fouten: string[] = [];
  a.on("pageerror", (e) => fouten.push(e.message));
  a.on("dialog", (d) => d.accept());
  await leeg(a, "/?cloud-demo");
  await openVoorbeeld(a);
  await a.getByRole("button", { name: /^Cloud/ }).click();
  await a.getByLabel("E-mailadres").fill("an@voorbeeld.be");
  await a.getByRole("button", { name: "Aanmelden" }).click();
  await a.getByRole("button", { name: "Bewaren in de cloud" }).click();
  await expect(a.locator(".cloud-lijst")).toContainText("Appartement Voorbeeldstraat 12");
  await a.getByRole("button", { name: "Sluiten" }).click();
  await expect(a.getByRole("button", { name: /Cloud: bewaard/ })).toBeVisible();
  const wolk = () => a.evaluate(() => localStorage.getItem("architect1.0:cloud-demo")!);

  // toestel B: zelfde cloud (de "server" kopiëren), leeg toestel
  const b = await (await browser.newContext()).newPage();
  b.on("dialog", (d) => d.accept());
  b.on("pageerror", (e) => fouten.push(e.message));
  await leeg(b, "/?cloud-demo");
  await b.evaluate((w) => localStorage.setItem("architect1.0:cloud-demo", w), await wolk());
  await b.reload();
  await b.getByRole("button", { name: /^Cloud/ }).click();
  await b.getByRole("dialog").getByRole("button", { name: "Openen" }).click();
  await expect(b.locator(".melding.bericht")).toContainText("geopend uit de cloud");
  // B wijzigt de naam → automatisch bewaard (versie 2)
  await b.getByLabel("Projectnaam").fill("Werf Kerkstraat");
  await b.getByLabel("Projectnaam").blur();
  await expect(b.getByRole("button", { name: /Cloud: bewaard/ })).toBeVisible({ timeout: 10000 });
  await expect.poll(() => b.evaluate(() => (Object.values(JSON.parse(localStorage.getItem("architect1.0:cloud-demo")!).projecten)[0] as { versie: number }).versie), { timeout: 10000 }).toBe(2);

  // A komt terug naar de app: haalt versie 2 op
  const naB = await b.evaluate(() => localStorage.getItem("architect1.0:cloud-demo")!);
  await a.evaluate((w) => { localStorage.setItem("architect1.0:cloud-demo", w); window.dispatchEvent(new Event("focus")); }, naB);
  await expect(a.getByLabel("Projectnaam")).toHaveValue("Werf Kerkstraat");
  await expect(a.locator(".melding.bericht")).toContainText("nieuwste versie uit de cloud");

  // conflict: A wijzigt lokaal (zonder bewaren: "offline"), B bewaart intussen versie 3
  await a.evaluate(() => { const d = JSON.parse(localStorage.getItem("architect1.0:cloud-demo")!); const id = Object.keys(d.projecten)[0]; d.projecten[id].versie = 3; d.projecten[id].naam = "Werf B"; d.projecten[id].data.naam = "Werf B"; localStorage.setItem("architect1.0:cloud-demo", JSON.stringify(d)); });
  await a.getByLabel("Projectnaam").fill("Werf A");
  await a.getByLabel("Projectnaam").blur();
  await expect(a.locator(".melding.conflict")).toContainText("ook op een ander toestel gewijzigd", { timeout: 10000 });
  await a.getByRole("button", { name: "Mijn versie (op dit toestel)" }).click();
  await expect(a.getByRole("button", { name: /Cloud: bewaard/ })).toBeVisible();
  expect(await a.evaluate(() => { const d = JSON.parse(localStorage.getItem("architect1.0:cloud-demo")!); const x = Object.values(d.projecten)[0] as { versie: number; naam: string }; return [x.versie, x.naam]; })).toEqual([4, "Werf A"]);
  expect(fouten).toEqual([]);
});

test("Supabase: geheime sleutel geweigerd; met publieke sleutel gaan de juiste aanvragen naar de server", async ({ page }) => {
  await leeg(page);
  await openVoorbeeld(page);
  await page.getByRole("button", { name: /^Cloud/ }).click();
  await page.getByLabel("Supabase-projectadres").fill("https://test1234.supabase.co");
  await page.getByLabel(/Publieke sleutel/).fill(jwt({ role: "service_role" }));
  await page.getByRole("button", { name: "Instellen" }).click();
  await expect(page.getByRole("dialog")).toContainText("service_role-sleutel (geheim)");
  await page.getByLabel(/Publieke sleutel/).fill("sb_secret_abc");
  await page.getByRole("button", { name: "Instellen" }).click();
  await expect(page.getByRole("dialog")).toContainText("GEHEIME sleutel");

  // nagebootste server
  const aanvragen: Array<{ pad: string; body: unknown; auth?: string }> = [];
  await page.route("https://test1234.supabase.co/**", async (route) => {
    const r = route.request();
    const pad = new URL(r.url()).pathname;
    aanvragen.push({ pad, body: r.postDataJSON?.() ?? null, auth: r.headers()["authorization"] });
    if (pad === "/auth/v1/otp") return route.fulfill({ json: {} });
    if (pad === "/rest/v1/rpc/bewaar_project") return route.fulfill({ json: 1 });
    if (pad === "/rest/v1/projecten") return route.fulfill({ json: [] });
    if (pad === "/rest/v1/project_leden") return route.fulfill({ json: [] });
    if (pad === "/auth/v1/user") return route.fulfill({ json: { id: "u1", email: "an@voorbeeld.be" } });
    return route.fulfill({ status: 404, json: {} });
  });
  await page.getByLabel(/Publieke sleutel/).fill(jwt({ role: "anon" }));
  await page.getByRole("button", { name: "Instellen" }).click();
  await page.getByLabel("E-mailadres").fill("an@voorbeeld.be");
  await page.getByRole("button", { name: "Stuur aanmeldlink" }).click();
  await expect(page.getByText("Kijk in je mailbox")).toBeVisible();
  expect(aanvragen.find((x) => x.pad === "/auth/v1/otp")!.body).toMatchObject({ email: "an@voorbeeld.be" });

  // aangemeld (sessie zoals na het openen van de link) en bewaren
  const nu = Math.floor(Date.now() / 1000);
  const token = jwt({ sub: "u1", email: "an@voorbeeld.be", role: "authenticated", exp: nu + 3600 });
  await page.evaluate(([t, nu2]) => localStorage.setItem("sb-test1234-auth-token", JSON.stringify({
    access_token: t, token_type: "bearer", expires_in: 3600, expires_at: Number(nu2) + 3600, refresh_token: "r",
    user: { id: "u1", aud: "authenticated", role: "authenticated", email: "an@voorbeeld.be", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
  })), [token, String(nu)]);
  await page.reload();
  await page.getByRole("button", { name: /^Cloud/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Aangemeld als an@voorbeeld.be");
  await page.getByRole("button", { name: "Bewaren in de cloud" }).click();
  await expect(page.getByRole("button", { name: /Cloud: bewaard/ })).toBeVisible();
  const rpc = aanvragen.find((x) => x.pad === "/rest/v1/rpc/bewaar_project")!;
  expect(rpc.body).toMatchObject({ p_naam: "Appartement Voorbeeldstraat 12", p_versie: 0 });
  expect(rpc.auth).toBe(`Bearer ${token}`);
});
