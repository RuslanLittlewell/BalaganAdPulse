import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { TEST_WORKERS } from "./test/workers";

export default defineConfig({
  resolve: {
    alias: {
      "@adpulse/access-policy": fileURLToPath(
        new URL("../../packages/access-policy/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    globalSetup: ["./test/global-setup.ts"],
    maxWorkers: TEST_WORKERS,
    env: { TZ: "UTC" },
  },
});
