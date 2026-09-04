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

config({ path: ".env.test", quiet: true, override: true });

const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");

const LEGACY_SCHEMA_PREFIX = "test_worker_";

async function dropSchema(admin: PrismaClient, nspname: string): Promise<void> {
  try {
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${nspname}" CASCADE`);
  } catch (error) {
    console.error(`[global-setup] failed to drop orphaned schema "${nspname}"`, error);
  }
}

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
