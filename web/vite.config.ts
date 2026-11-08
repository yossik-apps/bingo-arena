import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

/**
 * Opens the connection to the database while the game downloads, instead of after it starts: a preconnect to the
 * VITE_SUPABASE_URL origin in index.html. Added only when the variable is set (CI builds without it).
 */
const preconnect = (url: string | undefined): Plugin => ({
  name: "supabase-preconnect",
  transformIndexHtml: () => {
    let origin: string;
    try { origin = new URL(url ?? "").origin; } catch { return []; }
    return [{ tag: "link", attrs: { rel: "preconnect", href: origin, crossorigin: true }, injectTo: "head" }];
  },
});

// The game engine lives in supabase/functions/_shared so the browser and the server use the exact same rules.
export default defineConfig(({ mode }) => ({
  plugins: [react(), preconnect(loadEnv(mode, process.cwd(), "VITE_").VITE_SUPABASE_URL)],
  // Stamped into the website at build time and shown in the admin area.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __COMMIT__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7)),
  },
  resolve: { alias: { "@engine": fileURLToPath(new URL("../supabase/functions/_shared/engine.ts", import.meta.url)) } },
  server: { fs: { allow: [".."] } },
}));
