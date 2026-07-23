// Single source of truth for per-worker test database isolation.
//
// Vitest runs test files across multiple worker processes in parallel. Every
// DB-touching test file wipes the whole database in beforeEach via resetDb(),
// so two files running concurrently against the same schema race each other.
// Instead, each worker gets its own Postgres schema (test_worker_1, _2, ...)
// inside the shared `adpulse_test` database, so resetDb() in one worker never
// touches another worker's records.

export const TEST_WORKERS = 4;

export function schemaNameForWorker(workerId: number): string {
  return `test_worker_${workerId}`;
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
  baseUrl: string | undefined = process.env.DATABASE_URL,
): string {
  if (!baseUrl) {
    throw new Error(
      "DATABASE_URL is not set; load .env.test before calling databaseUrlForWorker()",
    );
  }
  const url = new URL(baseUrl);
  url.searchParams.set("schema", schemaNameForWorker(workerId));
  return url.toString();
}
