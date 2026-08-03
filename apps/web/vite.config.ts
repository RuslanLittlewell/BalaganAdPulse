/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      // Native dev talks to the API on localhost; inside Compose it is http://api:3000.
      "/api": process.env.API_PROXY_TARGET ?? "http://localhost:3000",
    },
    // Bind-mounted file events don't always propagate into containers on macOS.
    watch: process.env.CHOKIDAR_USEPOLLING === "true" ? { usePolling: true } : undefined,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
});
