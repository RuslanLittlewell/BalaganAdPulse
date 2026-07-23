import { defineConfig } from "vitest/config";
import { TEST_WORKERS } from "./test/workers";

export default defineConfig({
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
  },
});
