import { config } from "dotenv";
import { TEST_WORKERS, currentRunId, databaseUrlForWorker } from "./workers.js";

config({ path: ".env.test", quiet: true });

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

process.env.DATABASE_URL = databaseUrlForWorker(workerId, currentRunId());
