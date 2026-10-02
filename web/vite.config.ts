import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// The game engine lives in supabase/functions/_shared so the browser and the server use the exact same rules.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@engine": fileURLToPath(new URL("../supabase/functions/_shared/engine.ts", import.meta.url)) } },
  server: { fs: { allow: [".."] } },
});
