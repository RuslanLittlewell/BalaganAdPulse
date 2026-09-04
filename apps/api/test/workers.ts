import { randomBytes } from "node:crypto";

export const TEST_WORKERS = 4;

export const TEST_RUN_ID_ENV = "ADPULSE_TEST_RUN_ID";

export const ORPHAN_SCHEMA_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export function generateRunId(now: number = Date.now()): string {
  return `${now.toString(36)}${randomBytes(2).toString("hex")}`;
}

export function runIdCreatedAt(runId: string): number {
  return parseInt(runId.slice(0, 8), 36);
}

export function schemaNameForWorker(workerId: number, runId: string): string {
  return `test_run_${runId}_w${workerId}`;
}

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
