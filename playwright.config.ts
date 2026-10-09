import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testIgnore: "desktop.spec.ts",
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:5173",
    headless: true,
    timezoneId: "Asia/Shanghai",
  },
  webServer: {
    command: process.env.PREVIEW
      ? "npx vite preview --host 127.0.0.1 --port 5173"
      : "npx vite --host 127.0.0.1 --port 5173",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
  },
});
