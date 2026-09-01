import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { TEST_WORKERS } from "./test/workers";

export default defineConfig({
  // The API imports @adpulse/access-policy as built JS, which means a test run
  // could otherwise exercise a dist/ compiled from source that has since
  // changed — a stale permission matrix denying something the source allows.
  // Tests read the TypeScript directly; the build still produces the dist that
  // production runs on, and `npm run build` verifies it compiles.
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
    // Applies migrations to each worker's Postgres schema once, before any
    // worker starts. See test/global-setup.ts and test/workers.ts.
    globalSetup: ["./test/global-setup.ts"],
    // Test files share one Postgres database and each resets it via resetDb(),
    // which now cascades across FK-linked tables (Campaign -> Client, etc.).
    // Isolation comes from giving each worker its own schema (test/setup.ts),
    // not from serializing files, so parallelism stays on. Cap the worker
    // count to exactly TEST_WORKERS so a worker can never be assigned an id
    // beyond the set of schemas global setup actually migrated.
    maxWorkers: TEST_WORKERS,
    // Pins the suite's timezone so date-boundary behavior does not depend on
    // the host's local timezone. Matches the intent of apps/web/vite.config.ts's
    // TZ pin (though not its value: UTC is what the server actually runs as).
    env: { TZ: "UTC" },
  },
});
