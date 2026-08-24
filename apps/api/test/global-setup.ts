// Vitest global setup: runs once, before any worker starts, in the main
// process. Generates this run's id, publishes it to the worker processes
// through the environment, applies migrations to each worker's schema, and
// returns a teardown that drops them again.
//
// Migrations must run sequentially: Prisma's migrate engine takes a
// database-wide advisory lock while it applies them, so firing deploys
// concurrently against the same database just serializes them anyway (and can
// time out).

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import {
  ORPHAN_SCHEMA_MAX_AGE_MS,
  SCHEMA_PREFIX,
  TEST_RUN_ID_ENV,
  TEST_WORKERS,
  databaseUrlForWorker,
  generateRunId,
  runIdCreatedAt,
  schemaNameForWorker,
} from "./workers.js";

// override: true matters here specifically because this file, unlike the
// old version, imports @prisma/client below. The generated client loads
// apps/api/.env (the dev database, not .env.test) as a side effect of that
// import, and since dotenv does not overwrite an already-set variable by
// default, DATABASE_URL would otherwise be silently pinned to the dev
// database for the rest of this process — and every worker forked from it.
config({ path: ".env.test", quiet: true, override: true });

const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");

/** Legacy prefix from before this phase's run-scoped naming
 * (test/workers.ts), fixed names with no embedded timestamp:
 * `test_worker_1` .. `test_worker_4`. Any of those still around are
 * unambiguously pre-phase leftovers, never a concurrent run's schemas, so
 * they are dropped unconditionally rather than age-checked. */
const LEGACY_SCHEMA_PREFIX = "test_worker_";

/** Best-effort drop: a schema another process is concurrently dropping (or
 * racing to create) must not fail setup for the whole run. */
async function dropSchema(admin: PrismaClient, nspname: string): Promise<void> {
  try {
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${nspname}" CASCADE`);
  } catch (error) {
    console.error(`[global-setup] failed to drop orphaned schema "${nspname}"`, error);
  }
}

/** Drops schemas left behind by runs that were killed before teardown. A
 * concurrent run's schemas are young, so the age check leaves them alone. */
async function sweepOrphanedSchemas(admin: PrismaClient): Promise<void> {
  const rows = await admin.$queryRaw<Array<{ nspname: string }>>`
    SELECT nspname FROM pg_namespace
    WHERE nspname LIKE ${`${SCHEMA_PREFIX}%`} OR nspname LIKE ${`${LEGACY_SCHEMA_PREFIX}%`}
  `;
  const cutoff = Date.now() - ORPHAN_SCHEMA_MAX_AGE_MS;
  for (const { nspname } of rows) {
    if (nspname.startsWith(LEGACY_SCHEMA_PREFIX)) {
      await dropSchema(admin, nspname);
      continue;
    }
    const createdAt = runIdCreatedAt(nspname.slice(SCHEMA_PREFIX.length));
    if (Number.isFinite(createdAt) && createdAt < cutoff) {
      await dropSchema(admin, nspname);
    }
  }
}

export default async function setup(): Promise<() => Promise<void>> {
  const runId = generateRunId();
  // Set before any worker is forked: workers inherit process.env at fork time,
  // which is how test/setup.ts sees this value.
  process.env[TEST_RUN_ID_ENV] = runId;

  const admin = new PrismaClient();
  try {
    await sweepOrphanedSchemas(admin);
  } finally {
    await admin.$disconnect();
  }

  for (let workerId = 1; workerId <= TEST_WORKERS; workerId++) {
    try {
      execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
        // Explicit, fully-piped stdio: capture stdout/stderr instead of
        // letting Prisma's CLI output reach the terminal, so a successful
        // run stays silent and failures still surface via the catch below.
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          DATABASE_URL: databaseUrlForWorker(workerId, runId),
          CHECKPOINT_DISABLE: "1",
          PRISMA_HIDE_UPDATE_MESSAGE: "true",
        },
      });
    } catch (error) {
      const err = error as NodeJS.ErrnoException & { stdout?: Buffer; stderr?: Buffer };
      console.error(`[global-setup] prisma migrate deploy failed for worker ${workerId}`);
      if (err.stdout) console.error(err.stdout.toString());
      if (err.stderr) console.error(err.stderr.toString());
      throw error;
    }
  }

  return async function teardown(): Promise<void> {
    const client = new PrismaClient();
    try {
      for (let workerId = 1; workerId <= TEST_WORKERS; workerId++) {
        await client.$executeRawUnsafe(
          `DROP SCHEMA IF EXISTS "${schemaNameForWorker(workerId, runId)}" CASCADE`,
        );
      }
    } finally {
      await client.$disconnect();
    }
  };
}
