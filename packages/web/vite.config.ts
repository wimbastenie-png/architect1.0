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

// base "./" zodat de gebouwde app ook vanuit een submap of als los bestand werkt
export default defineConfig({ plugins: [react(), versieBestand()], base: "./", define: { __VERSIE__: JSON.stringify(VERSIE) } });
