import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// base "./" zodat de gebouwde app ook vanuit een submap of als los bestand werkt
export default defineConfig({ plugins: [react()], base: "./" });
