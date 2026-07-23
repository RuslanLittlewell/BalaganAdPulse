import { config } from "dotenv";
import { TEST_WORKERS, databaseUrlForWorker } from "./workers.js";

config({ path: ".env.test", quiet: true });

// Point this worker at its own Postgres schema before src/lib/prisma.ts (which
// instantiates PrismaClient at import time) gets pulled in by any test file.
//
// Confirmed empirically for vitest@4.1.10 (see task-1-report.md): the pool
// worker running this file sets VITEST_POOL_ID, bounded 1..maxWorkers, which
// is exactly what we need to map onto our fixed set of TEST_WORKERS schemas.
// VITEST_WORKER_ID also exists but is not bounded the same way, so it is not
// used here. If VITEST_POOL_ID is absent or invalid, throw immediately to
// prevent multiple workers from sharing the same schema and introducing race
// conditions.
const poolId = process.env.VITEST_POOL_ID;
if (!poolId) {
  throw new Error(
    `VITEST_POOL_ID is not set; expected a number from 1 to ${TEST_WORKERS}. ` +
    "Per-worker schema isolation cannot be guaranteed without it."
  );
}

const workerId = Number(poolId);
if (!Number.isInteger(workerId) || workerId < 1 || workerId > TEST_WORKERS) {
  throw new Error(
    `VITEST_POOL_ID=${poolId} is invalid; expected an integer from 1 to ${TEST_WORKERS}. ` +
    "Per-worker schema isolation cannot be guaranteed without it."
  );
}

process.env.DATABASE_URL = databaseUrlForWorker(workerId);
