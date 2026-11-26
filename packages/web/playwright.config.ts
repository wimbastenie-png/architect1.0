import { defineConfig, devices } from "@playwright/test";

/**
 * Browsertests van de webapp: echte klikken, slepen en aanraking.
 * - project "pc": Chrome op 1280 × 900
 * - project "gsm": Pixel 7 (Android, aanraking), enkel de *.gsm.spec.ts-bestanden
 * Draaien: `npm run e2e` (bouwt de app en start een lokale server op poort 4173).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]] : "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "off",
    screenshot: "only-on-failure",
    // service worker uit (anders ziet page.route de verzoeken niet); offline.spec.ts zet hem zelf aan
    serviceWorkers: "block",
  },
  projects: [
    { name: "pc", testIgnore: /\.gsm\.spec\.ts$/, use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "gsm", testMatch: /\.gsm\.spec\.ts$/, use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run build && npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
