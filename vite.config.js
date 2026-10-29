import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Pages deployment is a project page under /promptly/. Override with
// PUBLIC_BASE for user sites or custom domains.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = env.PUBLIC_BASE ? env.PUBLIC_BASE : "/promptly/";
  return {
    base,
    plugins: [react(), tailwindcss()],
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 900
    },
    worker: {
      format: "es"
    }
  };
});
// Vitest config lives in vitest.config.js; Playwright in playwright.config.js.
