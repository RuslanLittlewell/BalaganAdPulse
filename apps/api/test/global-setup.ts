// Vitest global setup: runs once, before any worker starts, in the main
// process. For each worker's schema, apply migrations with `prisma migrate
// deploy` so every worker finds an up-to-date schema waiting for it.
//
// This must run sequentially: Prisma's migrate engine takes a database-wide
// advisory lock while it applies migrations, so firing deploys concurrently
// against the same database just serializes them anyway (and can time out).
// Running them one at a time here avoids that contention entirely.

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { config } from "dotenv";
import { TEST_WORKERS, databaseUrlForWorker } from "./workers.js";

config({ path: ".env.test", quiet: true });

const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");

export default async function setup(): Promise<void> {
  for (let workerId = 1; workerId <= TEST_WORKERS; workerId++) {
    try {
      execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
        // Explicit, fully-piped stdio: capture stdout/stderr instead of
        // letting Prisma's CLI output reach the terminal, so a successful
        // run stays silent and failures still surface via the catch below.
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          DATABASE_URL: databaseUrlForWorker(workerId),
          // Keep output pristine: skip Prisma's telemetry/update check
          // entirely rather than just hiding its message, since the check
          // itself can print asynchronously outside our captured stdio.
          CHECKPOINT_DISABLE: "1",
          PRISMA_HIDE_UPDATE_MESSAGE: "true",
        },
      });
    } catch (error) {
      const err = error as NodeJS.ErrnoException & {
        stdout?: Buffer;
        stderr?: Buffer;
      };
      console.error(
        `[global-setup] prisma migrate deploy failed for worker ${workerId}`,
      );
      if (err.stdout) console.error(err.stdout.toString());
      if (err.stderr) console.error(err.stderr.toString());
      throw error;
    }
  }
}
