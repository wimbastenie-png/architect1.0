import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { defineConfig, type Plugin } from "vite";

/** Versie = korte commit + bouwtijd. Staat in de app én in versie.json, zodat de app een nieuwere online versie herkent. */
function versie(): string {
  let sha = (process.env.GITHUB_SHA ?? "").slice(0, 7);
  if (!sha) { try { sha = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { sha = "lokaal"; } }
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} · ${sha}`;
}
const VERSIE = versie();

const versieBestand = (): Plugin => ({
  name: "versie-json",
  generateBundle() { this.emitFile({ type: "asset", fileName: "versie.json", source: JSON.stringify({ versie: VERSIE }) }); },
});

/**
 * Service worker (offline werken): bewaart bij de eerste keer de hele app (alle bestanden van deze versie).
 * - de pagina zelf: eerst het netwerk, zonder netwerk de bewaarde versie;
 * - versie.json: altijd het netwerk (zo merkt de app een nieuwe versie op);
 * - de rest (bestanden met een vingerafdruk in de naam): eerst de bewaarde kopie.
 * Andere adressen (Supabase, kaarten …) gaan er niet door.
 */
const PUBLIEK = ["manifest.webmanifest", "icoon-192.png", "icoon-512.png", "icoon-maskable-512.png", "apple-touch-icon.png"];
export function swBron(versie: string, bestanden: string[]): string {
  return `/* architect1.0 service worker, versie ${versie} */
const CACHE = ${JSON.stringify("architect1.0 " + versie)};
const BESTANDEN = ${JSON.stringify(["./", ...bestanden])};
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BESTANDEN)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("architect1.0 ") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin !== self.location.origin) return;
  if (u.pathname.endsWith("/versie.json") || u.pathname.endsWith("/sw.js")) return;
  if (r.mode === "navigate") {
    e.respondWith(fetch(r).then((a) => { const k = a.clone(); if (a.ok) caches.open(CACHE).then((c) => c.put("./", k)); return a; })
      .catch(() => caches.match("./", { ignoreSearch: true }).then((x) => x || caches.match("index.html"))));
    return;
  }
  e.respondWith(caches.match(r, { ignoreSearch: true }).then((x) => x || fetch(r).then((a) => { if (a.ok) { const k = a.clone(); caches.open(CACHE).then((c) => c.put(r, k)); } return a; })));
});
`;
}
const serviceWorker = (): Plugin => ({
  name: "service-worker",
  enforce: "post",
  generateBundle(_o, bundle) {
    const bestanden = [...new Set([...Object.keys(bundle).filter((f) => f !== "versie.json" && !f.endsWith(".map")), "index.html", ...PUBLIEK])].sort();
    this.emitFile({ type: "asset", fileName: "sw.js", source: swBron(VERSIE, bestanden) });
  },
});

// base "./" zodat de gebouwde app ook vanuit een submap of als los bestand werkt
export default defineConfig({
  plugins: [react(), versieBestand(), serviceWorker()],
  base: "./",
  define: { __VERSIE__: JSON.stringify(VERSIE) },
  build: {
    rollupOptions: {
      // De rekenkern (packages/core) heeft geen neveneffecten bij het laden: wat niet gebruikt wordt,
      // mag weg, zodat de PDF-code (pdf-lib) alleen in het apart geladen stuk komt.
      treeshake: { moduleSideEffects: (id) => !/[\\/]packages[\\/]core[\\/]src[\\/]/.test(id) },
    },
  },
});
