import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// The game engine lives in supabase/functions/_shared so the browser and the server use the exact same rules.
export default defineConfig({
  plugins: [react()],
  // Stamped into the website at build time and shown in the admin area.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __COMMIT__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7)),
  },
  resolve: { alias: { "@engine": fileURLToPath(new URL("../supabase/functions/_shared/engine.ts", import.meta.url)) } },
  server: { fs: { allow: [".."] } },
});
