// Single source of truth for test database isolation.
//
// Vitest runs test files across multiple worker processes in parallel. Every
// DB-touching test file wipes its database in beforeEach via resetDb(), so two
// files sharing a schema race each other. Each worker therefore gets its own
// Postgres schema inside the shared `adpulse_test` database.
//
// The schema name is scoped to the *run* as well as the worker. Fixed names
// isolated workers from each other but not one `npm test` from another: two
// terminals both wrote to test_worker_1 and wiped each other's rows.
//
// The run id encodes its own creation time, so a run can drop schemas left
// behind by runs that were killed before their teardown ran — without a
// registry table, and without dropping a *concurrent* run's schemas.

import { randomBytes } from "node:crypto";

export const TEST_WORKERS = 4;

/** Carries the run id from global setup into the worker processes. */
export const TEST_RUN_ID_ENV = "ADPULSE_TEST_RUN_ID";

/** Schemas older than this are assumed to belong to a killed run. */
export const ORPHAN_SCHEMA_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/** 8 base-36 characters of millisecond timestamp (until the year 2059) plus 4
 * random hex characters, so two runs starting in the same millisecond still
 * differ. */
export function generateRunId(now: number = Date.now()): string {
  return `${now.toString(36)}${randomBytes(2).toString("hex")}`;
}

/** Recovers the creation time encoded by `generateRunId`. */
export function runIdCreatedAt(runId: string): number {
  return parseInt(runId.slice(0, 8), 36);
}

export function schemaNameForWorker(workerId: number, runId: string): string {
  return `test_run_${runId}_w${workerId}`;
}

/** Prefix for the schemas this module currently produces, for the orphan
 * sweep. Schemas from before this phase used a different, fixed-name scheme
 * (`test_worker_1` .. `test_worker_4`, no embedded timestamp) — see the
 * unconditional cleanup for those in test/global-setup.ts. */
export const SCHEMA_PREFIX = "test_run_";

export function currentRunId(env: NodeJS.ProcessEnv = process.env): string {
  const runId = env[TEST_RUN_ID_ENV];
  if (!runId) {
    throw new Error(
      `${TEST_RUN_ID_ENV} is not set; global setup must generate it before workers start. ` +
        "Without it, workers would share a schema and race each other.",
    );
  }
  return runId;
}

/**
 * Builds the DATABASE_URL for a given worker's schema, derived from the base
 * test database URL (normally loaded from `.env.test`, e.g.
 * `postgresql://postgres:postgres@localhost:5432/adpulse_test?schema=public`).
 *
 * Callers must ensure `.env.test` (or an equivalent DATABASE_URL) is loaded
 * before calling this — it does not load any env file itself, so it stays
 * side-effect free and safe to import from `vitest.config.ts`.
 */
export function databaseUrlForWorker(
  workerId: number,
  runId: string,
  baseUrl: string | undefined = process.env.DATABASE_URL,
): string {
  if (!baseUrl) {
    throw new Error(
      "DATABASE_URL is not set; load .env.test before calling databaseUrlForWorker()",
    );
  }
  const url = new URL(baseUrl);
  url.searchParams.set("schema", schemaNameForWorker(workerId, runId));
  return url.toString();
}
