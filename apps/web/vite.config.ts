/// <reference types="vitest/config" />
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const avataaarsReact17 = {
  name: "avataaars-react-17",
  enforce: "pre" as const,
  resolveId(source: string, importer?: string) {
    if (source !== "react" || !importer) return null;
    if (importer.includes("/avataaars/") || importer.includes("/react-dom17/")) {
      return this.resolve("react17", importer, { skipSelf: true });
    }
    return null;
  },
};

export default defineConfig({
  plugins: [avataaarsReact17, react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@test": path.resolve(__dirname, "./test"),
    },
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ["baker-cooper-scan-harley.trycloudflare.com"],
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET ?? "http://localhost:3000",
        ws: true,
      },
    },
    watch: process.env.CHOKIDAR_USEPOLLING === "true" ? { usePolling: true } : undefined,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./test/shared/setup.ts",
    css: true,
    env: { TZ: "Asia/Tokyo" },
  },
});
