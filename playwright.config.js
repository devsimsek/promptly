import { defineConfig } from "@playwright/test";

const PORT = 4173;
const base = process.env.PUBLIC_BASE || "/promptly/";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://localhost:${PORT}${base}`,
    viewport: { width: 390, height: 844 }, // phone-first posture
  },
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: `http://localhost:${PORT}${base}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
  projects: [{ name: "chromium", use: { channel: "chromium" } }],
});
