# Production Readiness and CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `main` able to build a production image that serves the API and the built SPA from one process, protect the unauthenticated auth routes, and gate every pull request behind CI — with nothing yet published.

**Architecture:** One Express process serves `/api` and the built SPA from a single origin, so there is no CORS layer. `/api/auth/*` is protected by two independent layers: a per-IP window at the HTTP edge, and a concurrency gate inside `password.ts` that bounds how many `scrypt` hashes may occupy the libuv threadpool at once. A multi-stage Debian-slim `Dockerfile.prod`, joining the existing development `Dockerfile`, compiles both workspaces and runs `node dist/server.js`. GitHub Actions runs both suites, `tsc`, and the web production build on every pull request and every push to `main`.

**Tech Stack:** TypeScript, Express 5, Prisma 6, PostgreSQL 16, Zod 4, Vitest + Supertest, Docker (multi-stage), GitHub Actions.

**Spec:** [docs/superpowers/specs/2026-08-19-adpulse-production-readiness-design.md](../specs/2026-08-19-adpulse-production-readiness-design.md)

## Global Constraints

- **English only** — code, comments, docs, commit messages, API error messages.
- **Conventional Commits** — `type(scope): subject`, imperative, lowercase, no trailing period.
- **TDD** — the failing test is written and observed failing before the implementation.
- **No new runtime dependencies.** This plan adds none. The rate limiter and the concurrency gate are hand-written for that reason.
- Error envelope stays `{ "error": { "message": string, "details"?: unknown } }`.
- Node version is exactly **26**, pinned in `.nvmrc`, `engines.node`, and every Dockerfile.
- `trust proxy` is exactly `1`. Never `true` — that would let a client forge `X-Forwarded-For` and defeat the per-IP limiter.
- The scrypt parameters (`N=16384, r=8, p=1`, 16-byte salt, 64-byte key, `salt:hash` hex) do **not** change.
- `login` must keep running `scrypt` for unknown emails. The timing-enumeration defence in `auth.service.ts` is load-bearing.
- Rate limits: `login` and `register` 10 per 15 min per IP; `refresh` and `logout` 60 per 15 min per IP.
- Gate limits: 2 concurrent hashes, queue depth 20, maximum wait 5000 ms.
- The health endpoint is `/healthz` and performs **no** database call.
- Run tests from the repository root with `npm test` (API) and `npm run test:web`. Postgres must be up: `npm run db:up`.
- Out of scope, deferred to phase 12: `render.yaml`, CD, `preDeployCommand`, secrets, backups, rollback.

## File Structure

| File | Responsibility |
|---|---|
| `.nvmrc` | The single Node version machines read |
| `apps/api/test/workers.ts` | Run-scoped schema naming and per-worker `DATABASE_URL` |
| `apps/api/test/global-setup.ts` | Create, migrate, and later drop this run's schemas; sweep orphans |
| `apps/api/src/errors.ts` | Adds `ServiceUnavailableError` with `expose`/`retryAfter` |
| `apps/api/src/middleware/error-handler.ts` | Honours `expose` and `Retry-After` |
| `apps/api/src/middleware/rate-limit.ts` | Per-IP fixed-window limiter (new) |
| `apps/api/src/lib/concurrency-gate.ts` | Generic bounded-concurrency gate (new) |
| `apps/api/src/auth/password.ts` | Applies the gate to both scrypt call sites |
| `apps/api/src/auth/auth.routes.ts` | Mounts the limiters per route |
| `apps/api/src/app.ts` | `trust proxy`, `/healthz`, `/api` 404, static, SPA fallback |
| `apps/api/src/shutdown.ts` | Testable drain-then-disconnect handler (new) |
| `apps/api/src/server.ts` | Wires the shutdown handler to `SIGTERM`/`SIGINT` |
| `apps/api/Dockerfile` | Development image, unchanged in shape (Compose, bind mounts, `npm run dev`) |
| `apps/api/Dockerfile.prod` | Multi-stage production image, joining the dev one (new) |
| `.github/workflows/ci.yml` | Three parallel jobs (new) |

---

### Task 1: Pin the Node version

Nothing here has a unit test — it is configuration. Its verification is that both suites still pass on the pinned version and that a fresh install is not rejected.

**Files:**
- Create: `.nvmrc`
- Modify: `package.json` (root, add `engines`)
- Modify: `apps/api/Dockerfile:1`, `apps/web/Dockerfile:1`

**Interfaces:**
- Consumes: nothing.
- Produces: `.nvmrc` containing `26`, read by `actions/setup-node` in Task 11 and by `nvm use` locally.

- [ ] **Step 1: Create `.nvmrc`**

```
26
```

- [ ] **Step 2: Add `engines` to the root `package.json`**

Insert after the `"private": true,` line:

```json
  "engines": {
    "node": ">=26 <27"
  },
```

- [ ] **Step 3: Bump both development Dockerfiles**

In `apps/api/Dockerfile` and `apps/web/Dockerfile`, change line 1:

```dockerfile
FROM node:26-slim
```

Alpine is dropped here as well as in the production image: Prisma's engine resolution on musl requires an explicit `binaryTargets`, and a Debian base needs none.

- [ ] **Step 4: Verify the local toolchain matches**

Run: `node -v`
Expected: `v26.x.x`. If it is not, run `nvm use` (it now reads `.nvmrc`).

- [ ] **Step 5: Verify both suites still pass**

Run: `npm run db:up && npm test && npm run test:web`
Expected: 209 API tests pass, 254 web tests pass.

- [ ] **Step 6: Commit**

```bash
git add .nvmrc package.json apps/api/Dockerfile apps/web/Dockerfile
git commit -m "chore: pin node 26 across dev, ci and images"
```

---

### Task 2: Run-scoped test schemas

Two concurrent `npm test` invocations currently share `test_worker_1..4`, and `resetDb()` in one wipes the other's rows mid-test. Schema names gain a per-run id.

The run id carries its own creation time so orphaned schemas from killed runs can be swept without a registry table: it is `Date.now().toString(36)` (8 characters until the year 2059) followed by 4 random hex characters.

**Files:**
- Modify: `apps/api/test/workers.ts`
- Modify: `apps/api/test/global-setup.ts`
- Modify: `apps/api/test/setup.ts`
- Create: `apps/api/test/workers.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `TEST_RUN_ID_ENV = "ADPULSE_TEST_RUN_ID"`
  - `generateRunId(now?: number): string`
  - `runIdCreatedAt(runId: string): number`
  - `schemaNameForWorker(workerId: number, runId: string): string`
  - `currentRunId(env?: NodeJS.ProcessEnv): string`
  - `databaseUrlForWorker(workerId: number, runId: string, baseUrl?: string): string`

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/test/workers.test.ts
import { describe, it, expect } from "vitest";
import {
  TEST_RUN_ID_ENV,
  currentRunId,
  databaseUrlForWorker,
  generateRunId,
  runIdCreatedAt,
  schemaNameForWorker,
} from "./workers.js";

describe("generateRunId", () => {
  it("encodes the creation time so orphans can be swept", () => {
    const now = 1_755_600_000_000;
    expect(runIdCreatedAt(generateRunId(now))).toBe(now);
  });

  it("differs between two runs started in the same millisecond", () => {
    const now = 1_755_600_000_000;
    expect(generateRunId(now)).not.toBe(generateRunId(now));
  });

  it("stays inside Postgres's 63-character identifier limit", () => {
    expect(schemaNameForWorker(4, generateRunId()).length).toBeLessThan(63);
  });
});

describe("schemaNameForWorker", () => {
  it("gives each worker of a run its own schema", () => {
    const runId = generateRunId();
    expect(schemaNameForWorker(1, runId)).not.toBe(schemaNameForWorker(2, runId));
  });

  it("gives two runs different schemas for the same worker", () => {
    expect(schemaNameForWorker(1, generateRunId())).not.toBe(
      schemaNameForWorker(1, generateRunId()),
    );
  });
});

describe("currentRunId", () => {
  it("reads the id from the environment", () => {
    expect(currentRunId({ [TEST_RUN_ID_ENV]: "abc123" })).toBe("abc123");
  });

  it("throws when the id is absent, rather than sharing a schema", () => {
    expect(() => currentRunId({})).toThrow(/ADPULSE_TEST_RUN_ID/);
  });
});

describe("databaseUrlForWorker", () => {
  it("points the url at this worker's schema", () => {
    const url = databaseUrlForWorker(
      2,
      "abc123",
      "postgresql://postgres:postgres@localhost:5432/adpulse_test?schema=public",
    );
    expect(new URL(url).searchParams.get("schema")).toBe(schemaNameForWorker(2, "abc123"));
  });

  it("throws without a base url", () => {
    expect(() => databaseUrlForWorker(1, "abc123", undefined)).toThrow(/DATABASE_URL/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/workers.test.ts --root apps/api`
Expected: FAIL — `generateRunId`, `runIdCreatedAt`, `currentRunId` are not exported.

- [ ] **Step 3: Rewrite `apps/api/test/workers.ts`**

```ts
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

/** Every schema this module has ever produced, for the orphan sweep. */
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/workers.test.ts --root apps/api`
Expected: PASS — 9 tests.

- [ ] **Step 5: Rewrite `apps/api/test/global-setup.ts`**

```ts
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

config({ path: ".env.test", quiet: true });

const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");

/** Drops schemas left behind by runs that were killed before teardown. A
 * concurrent run's schemas are young, so the age check leaves them alone. */
async function sweepOrphanedSchemas(admin: PrismaClient): Promise<void> {
  const rows = await admin.$queryRaw<Array<{ nspname: string }>>`
    SELECT nspname FROM pg_namespace WHERE nspname LIKE ${`${SCHEMA_PREFIX}%`}
  `;
  const cutoff = Date.now() - ORPHAN_SCHEMA_MAX_AGE_MS;
  for (const { nspname } of rows) {
    const createdAt = runIdCreatedAt(nspname.slice(SCHEMA_PREFIX.length));
    if (Number.isFinite(createdAt) && createdAt < cutoff) {
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${nspname}" CASCADE`);
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
```

- [ ] **Step 6: Update `apps/api/test/setup.ts` to use the run id**

Replace the final line and add the import. The `VITEST_POOL_ID` block above it is unchanged.

```ts
import { config } from "dotenv";
import { TEST_WORKERS, currentRunId, databaseUrlForWorker } from "./workers.js";
```

and the last line becomes:

```ts
process.env.DATABASE_URL = databaseUrlForWorker(workerId, currentRunId());
```

- [ ] **Step 7: Verify the run id actually reaches the workers**

This is the assumption the whole task rests on, and the repository has a precedent for checking such things empirically rather than trusting them (see the `VITEST_POOL_ID` comment in `test/setup.ts`).

Run: `npm run db:up && npm test`
Expected: all 209 tests pass.

If instead every test fails with `ADPULSE_TEST_RUN_ID is not set`, `process.env` does not propagate to workers on this Vitest version. Fall back to Vitest's `provide`/`inject`: in `global-setup.ts` call `provide("adpulseTestRunId", runId)` on the injected context, and in `setup.ts` read it with `inject("adpulseTestRunId")`. Record whichever mechanism worked in a comment in `setup.ts`, naming the Vitest version, matching the existing comment's style.

- [ ] **Step 8: Verify two concurrent runs no longer collide**

Run, in two terminals started within a second of each other:

```bash
npm test
```

Expected: both runs pass. Before this task, one or both failed with rows disappearing mid-test.

- [ ] **Step 9: Verify teardown leaves no schemas behind**

Run:

```bash
docker compose exec db psql -U postgres -d adpulse_test -c \
  "SELECT nspname FROM pg_namespace WHERE nspname LIKE 'test_run_%'"
```

Expected: no rows once every run has finished.

- [ ] **Step 10: Commit**

```bash
git add apps/api/test/workers.ts apps/api/test/workers.test.ts \
        apps/api/test/global-setup.ts apps/api/test/setup.ts
git commit -m "test(api): scope worker schemas to each test run"
```

---

### Task 3: A 5xx the error handler is allowed to show

`errorHandler` maps every status at or above 500 to a logged, generic `"Internal error"`. That is right for a Prisma error carrying absolute source paths, and wrong for the deliberate backpressure signal Task 6 needs to send.

**Files:**
- Modify: `apps/api/src/errors.ts`
- Modify: `apps/api/src/middleware/error-handler.ts`
- Modify: `apps/api/test/middleware/error-handler.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `class ServiceUnavailableError extends Error` with `status = 503`, `expose = true`, `retryAfter?: number`; constructor `(message?: string, retryAfter?: number)`.

- [ ] **Step 1: Write the failing test**

Append to `apps/api/test/middleware/error-handler.test.ts`, following the fake `Request`/`Response` pattern already used in that file:

```ts
import { ServiceUnavailableError } from "../../src/errors.js";

describe("errorHandler and deliberate 5xx errors", () => {
  it("keeps the message of an error marked expose", () => {
    const res = mockResponse();
    errorHandler(new ServiceUnavailableError("Server is busy"), mockRequest(), res, () => {});
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: { message: "Server is busy" } });
  });

  it("sets Retry-After when the error carries one", () => {
    const res = mockResponse();
    errorHandler(new ServiceUnavailableError("Server is busy", 3), mockRequest(), res, () => {});
    expect(res.headers["Retry-After"]).toBe("3");
  });

  it("still hides the message of an unplanned 500", () => {
    const res = mockResponse();
    errorHandler(new Error("Prisma leaked /Users/someone/secret.ts"), mockRequest(), res, () => {});
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: { message: "Internal error" } });
  });
});
```

If the existing file has no `mockResponse` capturing headers, extend its helper so `res.setHeader(name, value)` records into `res.headers`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/middleware/error-handler.test.ts --root apps/api`
Expected: FAIL — `ServiceUnavailableError` is not exported.

- [ ] **Step 3: Add the error class**

Append to `apps/api/src/errors.ts`:

```ts
/** A 5xx whose message was written to be read by the caller.
 *
 * `errorHandler` replaces the message of every unplanned 5xx with a fixed
 * string, because errors that were never meant for a stranger leak detail —
 * Prisma's carry absolute source paths. Backpressure is different: the caller
 * needs to be told to come back later, and `retryAfter` tells them when. */
export class ServiceUnavailableError extends Error {
  status = 503;
  expose = true;
  retryAfter?: number;

  constructor(message = "Service unavailable", retryAfter?: number) {
    super(message);
    this.name = "ServiceUnavailableError";
    this.retryAfter = retryAfter;
  }
}
```

- [ ] **Step 4: Teach the handler about `expose` and `retryAfter`**

In `apps/api/src/middleware/error-handler.ts`, after the `status` assignment and before the `status >= 500` branch:

```ts
  const expose = (err as { expose?: boolean }).expose === true;
  const retryAfter = (err as { retryAfter?: number }).retryAfter;
  if (typeof retryAfter === "number") res.setHeader("Retry-After", String(retryAfter));
```

and change the branch condition:

```ts
  if (status >= 500 && !expose) {
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/middleware/error-handler.test.ts --root apps/api`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/errors.ts apps/api/src/middleware/error-handler.ts \
        apps/api/test/middleware/error-handler.test.ts
git commit -m "feat(api): let deliberate 5xx errors keep their message"
```

---

### Task 4: Per-IP rate limiter

A fixed window keyed by client address. The store is bounded in two ways, because a `Map` keyed by attacker-controlled input is a memory-exhaustion vector created by the defence against one.

**Files:**
- Create: `apps/api/src/middleware/rate-limit.ts`
- Create: `apps/api/test/middleware/rate-limit.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `createRateLimit(options: RateLimitOptions): RateLimiter`, where `RateLimitOptions = { windowMs: number; limit: number; maxKeys?: number; sweepIntervalMs?: number }` and `RateLimiter` is an Express `RequestHandler` with two extra methods: `reset(): void` and `stop(): void`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/test/middleware/rate-limit.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { createRateLimit } from "../../src/middleware/rate-limit.js";

function mockRequest(ip = "1.2.3.4"): Request {
  return { ip } as Request;
}

interface Captured {
  res: Response;
  statusCode?: number;
  body?: unknown;
  headers: Record<string, string>;
}

function mockResponse(): Captured {
  const captured: Captured = { headers: {} } as Captured;
  const res = {
    status(code: number) { captured.statusCode = code; return this; },
    json(payload: unknown) { captured.body = payload; return this; },
    setHeader(name: string, value: string) { captured.headers[name] = value; },
  } as unknown as Response;
  captured.res = res;
  return captured;
}

function call(limiter: ReturnType<typeof createRateLimit>, ip: string) {
  const captured = mockResponse();
  const next = vi.fn() as unknown as NextFunction;
  limiter(mockRequest(ip), captured.res, next);
  return { captured, next: next as unknown as ReturnType<typeof vi.fn> };
}

describe("createRateLimit", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("lets requests through up to the limit", () => {
    const limiter = createRateLimit({ windowMs: 1000, limit: 3 });
    for (let i = 0; i < 3; i++) expect(call(limiter, "1.1.1.1").next).toHaveBeenCalled();
    limiter.stop();
  });

  it("answers 429 past the limit", () => {
    const limiter = createRateLimit({ windowMs: 1000, limit: 2 });
    call(limiter, "1.1.1.1");
    call(limiter, "1.1.1.1");
    const { captured, next } = call(limiter, "1.1.1.1");
    expect(next).not.toHaveBeenCalled();
    expect(captured.statusCode).toBe(429);
    expect(captured.body).toEqual({
      error: { message: "Too many requests, try again later" },
    });
    limiter.stop();
  });

  it("sets Retry-After to the seconds left in the window", () => {
    const limiter = createRateLimit({ windowMs: 10_000, limit: 1 });
    call(limiter, "1.1.1.1");
    vi.advanceTimersByTime(4000);
    const { captured } = call(limiter, "1.1.1.1");
    expect(captured.headers["Retry-After"]).toBe("6");
    limiter.stop();
  });

  it("counts each address separately", () => {
    const limiter = createRateLimit({ windowMs: 1000, limit: 1 });
    call(limiter, "1.1.1.1");
    expect(call(limiter, "2.2.2.2").next).toHaveBeenCalled();
    limiter.stop();
  });

  it("starts a fresh window once the old one expires", () => {
    const limiter = createRateLimit({ windowMs: 1000, limit: 1 });
    call(limiter, "1.1.1.1");
    expect(call(limiter, "1.1.1.1").captured.statusCode).toBe(429);
    vi.advanceTimersByTime(1001);
    expect(call(limiter, "1.1.1.1").next).toHaveBeenCalled();
    limiter.stop();
  });

  it("sweeps expired entries instead of growing forever", () => {
    const limiter = createRateLimit({ windowMs: 1000, limit: 5, sweepIntervalMs: 500 });
    for (let i = 0; i < 50; i++) call(limiter, `10.0.0.${i}`);
    expect(limiter.size()).toBe(50);
    vi.advanceTimersByTime(2000);
    expect(limiter.size()).toBe(0);
    limiter.stop();
  });

  it("evicts the entry expiring soonest rather than exceeding its key cap", () => {
    const limiter = createRateLimit({ windowMs: 60_000, limit: 5, maxKeys: 3 });
    call(limiter, "10.0.0.1");
    vi.advanceTimersByTime(10);
    call(limiter, "10.0.0.2");
    vi.advanceTimersByTime(10);
    call(limiter, "10.0.0.3");
    call(limiter, "10.0.0.4");
    expect(limiter.size()).toBe(3);
    // The newcomer was admitted, and the oldest window made room for it.
    expect(call(limiter, "10.0.0.4").next).toHaveBeenCalled();
    limiter.stop();
  });

  it("reset() clears every window", () => {
    const limiter = createRateLimit({ windowMs: 1000, limit: 1 });
    call(limiter, "1.1.1.1");
    limiter.reset();
    expect(call(limiter, "1.1.1.1").next).toHaveBeenCalled();
    limiter.stop();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/middleware/rate-limit.test.ts --root apps/api`
Expected: FAIL — cannot resolve `../../src/middleware/rate-limit.js`.

- [ ] **Step 3: Implement the limiter**

```ts
// apps/api/src/middleware/rate-limit.ts
import type { NextFunction, Request, RequestHandler, Response } from "express";

export interface RateLimitOptions {
  windowMs: number;
  limit: number;
  /** Ceiling on tracked addresses. See the comment on `admit`. */
  maxKeys?: number;
  sweepIntervalMs?: number;
}

export interface RateLimiter extends RequestHandler {
  /** Number of tracked addresses. Exposed so the bound can be asserted. */
  size(): number;
  /** Drops every window. Tests share one module-level limiter across cases. */
  reset(): void;
  /** Clears the sweep interval. */
  stop(): void;
}

interface Window {
  count: number;
  resetAt: number;
}

const DEFAULT_MAX_KEYS = 10_000;
const DEFAULT_SWEEP_INTERVAL_MS = 60_000;

/** A fixed window per client address, held in memory.
 *
 * In memory is not a compromise here: the service runs as a single process, so
 * there is no second instance whose counters would need to agree with these.
 *
 * The store is bounded twice over. A periodic sweep drops windows that have
 * expired, and a hard key cap covers the case the sweep cannot — a burst from
 * many forged addresses arriving faster than the sweep interval. Without both,
 * the defence against a flood would itself be a way to exhaust a 512 MB
 * process's memory. */
export function createRateLimit(options: RateLimitOptions): RateLimiter {
  const {
    windowMs,
    limit,
    maxKeys = DEFAULT_MAX_KEYS,
    sweepIntervalMs = DEFAULT_SWEEP_INTERVAL_MS,
  } = options;

  const windows = new Map<string, Window>();

  function sweep(now = Date.now()): void {
    for (const [key, window] of windows) {
      if (window.resetAt <= now) windows.delete(key);
    }
  }

  /** Makes room for a new address when the cap is reached: sweep first, and if
   * everything tracked is still live, drop the window closest to expiring.
   *
   * Evicting rather than refusing is deliberate. Refusing new keys would let an
   * attacker fill the table and lock every genuine user out; admitting without
   * a bound would let them exhaust memory. Evicting the soonest-to-expire
   * window costs an attacker their own oldest counter first. */
  function admit(now: number): void {
    if (windows.size < maxKeys) return;
    sweep(now);
    if (windows.size < maxKeys) return;
    let oldestKey: string | undefined;
    let oldestResetAt = Infinity;
    for (const [key, window] of windows) {
      if (window.resetAt < oldestResetAt) {
        oldestResetAt = window.resetAt;
        oldestKey = key;
      }
    }
    if (oldestKey !== undefined) windows.delete(oldestKey);
  }

  const timer = setInterval(() => sweep(), sweepIntervalMs);
  // Unreferenced so a pending sweep can never hold the process open while it
  // drains on SIGTERM.
  timer.unref();

  const middleware = (req: Request, res: Response, next: NextFunction): void => {
    // `req.ip` is only trustworthy because app.ts sets `trust proxy` to 1.
    // With `true`, a client could prepend a forged X-Forwarded-For entry and
    // get a fresh window for every request.
    const key = req.ip ?? "unknown";
    const now = Date.now();

    let window = windows.get(key);
    if (!window || window.resetAt <= now) {
      admit(now);
      window = { count: 0, resetAt: now + windowMs };
      windows.set(key, window);
    }

    window.count += 1;
    if (window.count > limit) {
      res.setHeader("Retry-After", String(Math.ceil((window.resetAt - now) / 1000)));
      res.status(429).json({ error: { message: "Too many requests, try again later" } });
      return;
    }

    next();
  };

  return Object.assign(middleware, {
    size: () => windows.size,
    reset: () => windows.clear(),
    stop: () => clearInterval(timer),
  }) as RateLimiter;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/middleware/rate-limit.test.ts --root apps/api`
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/middleware/rate-limit.ts apps/api/test/middleware/rate-limit.test.ts
git commit -m "feat(api): add a bounded per-ip rate limiter"
```

---

### Task 5: Trust the proxy and mount the limiters

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/auth/auth.routes.ts`
- Modify: `apps/api/test/auth/auth.api.test.ts`
- Create: `apps/api/test/auth/auth.rate-limit.test.ts`

**Interfaces:**
- Consumes: `createRateLimit` from Task 4.
- Produces: `resetAuthRateLimits(): void` exported from `apps/api/src/auth/auth.routes.ts`.

> **This task changes an existing test file.** `auth.api.test.ts` makes more than ten requests to `/api/auth/*` from one address, so without a reset between cases it would start tripping the new limit. That is not a flaw in the limit; it is what the limit is for.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/test/auth/auth.rate-limit.test.ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetDb } from "../helpers/db.js";
import { resetAuthRateLimits } from "../../src/auth/auth.routes.js";

const app = createApp();
const credentials = { email: "buyer@acme.com", password: "hunter2hunter2" };

beforeEach(async () => {
  await resetDb();
  resetAuthRateLimits();
});
afterAll(async () => { await prisma.$disconnect(); });

describe("Auth rate limiting", () => {
  it("answers 429 after ten login attempts from one address", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await request(app).post("/api/auth/login").send(credentials);
      expect(res.status).toBe(401);
    }
    const res = await request(app).post("/api/auth/login").send(credentials);
    expect(res.status).toBe(429);
    expect(res.body.error.message).toBe("Too many requests, try again later");
    expect(res.headers["retry-after"]).toBeDefined();
  });

  it("counts a forwarded address rather than the proxy's", async () => {
    for (let i = 0; i < 10; i++) {
      await request(app).post("/api/auth/login")
        .set("X-Forwarded-For", "203.0.113.9").send(credentials);
    }
    const blocked = await request(app).post("/api/auth/login")
      .set("X-Forwarded-For", "203.0.113.9").send(credentials);
    expect(blocked.status).toBe(429);

    const other = await request(app).post("/api/auth/login")
      .set("X-Forwarded-For", "203.0.113.10").send(credentials);
    expect(other.status).toBe(401);
  });

  it("ignores a forged chain longer than one hop", async () => {
    // trust proxy = 1 takes only the last entry, so prepending addresses
    // cannot mint a fresh window per request.
    for (let i = 0; i < 10; i++) {
      await request(app).post("/api/auth/login")
        .set("X-Forwarded-For", `10.0.0.${i}, 203.0.113.20`).send(credentials);
    }
    const res = await request(app).post("/api/auth/login")
      .set("X-Forwarded-For", "10.0.0.99, 203.0.113.20").send(credentials);
    expect(res.status).toBe(429);
  });

  it("gives refresh a higher ceiling than login", async () => {
    for (let i = 0; i < 11; i++) {
      const res = await request(app).post("/api/auth/refresh").send({ refreshToken: "nope" });
      expect(res.status).toBe(401);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/auth/auth.rate-limit.test.ts --root apps/api`
Expected: FAIL — `resetAuthRateLimits` is not exported.

- [ ] **Step 3: Mount the limiters on the auth routes**

Replace `apps/api/src/auth/auth.routes.ts`:

```ts
import { Router } from "express";
import { createRateLimit } from "../middleware/rate-limit.js";
import * as controller from "./auth.controller.js";

const WINDOW_MS = 15 * 60 * 1000;

/** `login` and `register` are the routes that cost a scrypt hash, so they get
 * the tight window. Ten attempts in a quarter of an hour is generous for
 * someone typing a password and mean for anything else. */
const credentialLimit = createRateLimit({ windowMs: WINDOW_MS, limit: 10 });

/** `refresh` and `logout` are a database lookup and a SHA-256 digest. The
 * ceiling is higher because a signed-in tab renews every fifteen minutes and a
 * user may have several open — that is ordinary traffic, not an attack. */
const sessionLimit = createRateLimit({ windowMs: WINDOW_MS, limit: 60 });

/** Mounted at /api/auth, ahead of requireAuth — these are the only open routes. */
export const authRouter = Router();
authRouter.post("/register", credentialLimit, controller.register);
authRouter.post("/login", credentialLimit, controller.login);
authRouter.post("/refresh", sessionLimit, controller.refresh);
authRouter.post("/logout", sessionLimit, controller.logout);

/** The limiters are module state, so a test file's cases would otherwise share
 * one window and the later ones would answer 429 for reasons of their own
 * making. */
export function resetAuthRateLimits(): void {
  credentialLimit.reset();
  sessionLimit.reset();
}
```

- [ ] **Step 4: Set `trust proxy` in `app.ts`**

In `apps/api/src/app.ts`, immediately after `const app = express();`:

```ts
  // Exactly one proxy sits in front of this service in production. `true` would
  // trust the whole X-Forwarded-For chain, letting any client prepend a forged
  // address and hand itself a fresh rate-limit window per request.
  app.set("trust proxy", 1);
```

- [ ] **Step 5: Reset the limiters in the existing auth API test**

In `apps/api/test/auth/auth.api.test.ts`, add the import and extend the existing hook:

```ts
import { resetAuthRateLimits } from "../../src/auth/auth.routes.js";
```

```ts
beforeEach(async () => { await resetDb(); resetAuthRateLimits(); });
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run test/auth --root apps/api`
Expected: PASS — the new rate-limit file and the existing auth files.

- [ ] **Step 7: Run the whole API suite**

Run: `npm test`
Expected: all tests pass, including the 209 that existed before.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/app.ts apps/api/src/auth/auth.routes.ts \
        apps/api/test/auth/auth.rate-limit.test.ts apps/api/test/auth/auth.api.test.ts
git commit -m "feat(auth): rate limit the open auth routes per address"
```

---

### Task 6: Bound scrypt concurrency

The limiter stops one address hammering the service. It cannot stop a burst spread across addresses from occupying every libuv thread — and `login` is designed to spend a full 16 MB scrypt hash on every anonymous request, including ones whose email matches nobody.

**Files:**
- Create: `apps/api/src/lib/concurrency-gate.ts`
- Create: `apps/api/test/lib/concurrency-gate.test.ts`
- Modify: `apps/api/src/auth/password.ts`
- Create: `apps/api/test/auth/scrypt-gate.test.ts`

**Interfaces:**
- Consumes: `ServiceUnavailableError` from Task 3.
- Produces:
  - `createGate(options: GateOptions): Gate`, where `GateOptions = { maxConcurrent: number; maxQueue: number; maxWaitMs: number }`
  - `Gate = { run<T>(fn: () => Promise<T>): Promise<T>; stats(): { active: number; queued: number; total: number } }`
  - `scryptGate: Gate` exported from `apps/api/src/auth/password.ts`

- [ ] **Step 1: Write the failing test for the gate**

```ts
// apps/api/test/lib/concurrency-gate.test.ts
import { describe, it, expect } from "vitest";
import { createGate } from "../../src/lib/concurrency-gate.js";
import { ServiceUnavailableError } from "../../src/errors.js";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}

describe("createGate", () => {
  it("runs up to maxConcurrent tasks at once and no more", async () => {
    const gate = createGate({ maxConcurrent: 2, maxQueue: 10, maxWaitMs: 1000 });
    const blockers = [deferred(), deferred(), deferred()];
    let peak = 0;

    const runs = blockers.map((blocker) =>
      gate.run(async () => {
        peak = Math.max(peak, gate.stats().active);
        await blocker.promise;
      }),
    );

    // setImmediate, not Promise.resolve(): the gate's own `await acquire()`
    // costs a microtask per task, so a single microtask tick is not enough for
    // all three to have reached the gate.
    await new Promise((resolve) => setImmediate(resolve));
    expect(gate.stats().active).toBe(2);
    expect(gate.stats().queued).toBe(1);

    blockers.forEach((b) => b.resolve());
    await Promise.all(runs);
    expect(peak).toBe(2);
    expect(gate.stats().active).toBe(0);
  });

  it("rejects with 503 once the queue is full", async () => {
    const gate = createGate({ maxConcurrent: 1, maxQueue: 1, maxWaitMs: 1000 });
    const blocker = deferred();
    const running = gate.run(() => blocker.promise);
    const queued = gate.run(async () => {});

    await expect(gate.run(async () => {})).rejects.toBeInstanceOf(ServiceUnavailableError);

    blocker.resolve();
    await Promise.all([running, queued]);
  });

  it("rejects with 503 when the wait exceeds maxWaitMs", async () => {
    const gate = createGate({ maxConcurrent: 1, maxQueue: 5, maxWaitMs: 20 });
    const blocker = deferred();
    const running = gate.run(() => blocker.promise);

    await expect(gate.run(async () => {})).rejects.toThrow(/busy/i);

    blocker.resolve();
    await running;
  });

  it("releases its slot even when the task throws", async () => {
    const gate = createGate({ maxConcurrent: 1, maxQueue: 1, maxWaitMs: 100 });
    await expect(gate.run(async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(gate.stats().active).toBe(0);
    await expect(gate.run(async () => "ok")).resolves.toBe("ok");
  });

  it("counts every completed run", async () => {
    const gate = createGate({ maxConcurrent: 2, maxQueue: 2, maxWaitMs: 100 });
    await gate.run(async () => {});
    await gate.run(async () => {});
    expect(gate.stats().total).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/lib/concurrency-gate.test.ts --root apps/api`
Expected: FAIL — cannot resolve `../../src/lib/concurrency-gate.js`.

- [ ] **Step 3: Implement the gate**

```ts
// apps/api/src/lib/concurrency-gate.ts
import { ServiceUnavailableError } from "../errors.js";

export interface GateOptions {
  maxConcurrent: number;
  maxQueue: number;
  maxWaitMs: number;
}

export interface GateStats {
  active: number;
  queued: number;
  /** Runs admitted since start. Lets a caller assert that work was attempted
   * without measuring how long it took. */
  total: number;
}

export interface Gate {
  run<T>(fn: () => Promise<T>): Promise<T>;
  stats(): GateStats;
}

interface Waiter {
  resolve: () => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

/** Caps how many tasks may be in flight at once, queueing the rest and shedding
 * load past a bounded queue.
 *
 * Written rather than installed because the queue is the point: a limiter would
 * cap arrivals, and what needs capping here is occupancy. */
export function createGate(options: GateOptions): Gate {
  const { maxConcurrent, maxQueue, maxWaitMs } = options;
  const queue: Waiter[] = [];
  let active = 0;
  let total = 0;

  function busy(): ServiceUnavailableError {
    return new ServiceUnavailableError("Server is busy, try again shortly", 1);
  }

  function release(): void {
    active -= 1;
    const next = queue.shift();
    if (!next) return;
    clearTimeout(next.timer);
    active += 1;
    next.resolve();
  }

  async function acquire(): Promise<void> {
    if (active < maxConcurrent) {
      active += 1;
      return;
    }
    if (queue.length >= maxQueue) throw busy();

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = queue.findIndex((waiter) => waiter.timer === timer);
        if (index >= 0) queue.splice(index, 1);
        reject(busy());
      }, maxWaitMs);
      // Never hold the process open on a queued request during shutdown.
      timer.unref();
      queue.push({ resolve, reject, timer });
    });
  }

  return {
    async run<T>(fn: () => Promise<T>): Promise<T> {
      await acquire();
      total += 1;
      try {
        return await fn();
      } finally {
        release();
      }
    },
    stats: () => ({ active, queued: queue.length, total }),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/lib/concurrency-gate.test.ts --root apps/api`
Expected: PASS — 5 tests.

- [ ] **Step 5: Write the failing test for the gated password functions**

```ts
// apps/api/test/auth/scrypt-gate.test.ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetDb } from "../helpers/db.js";
import { resetAuthRateLimits } from "../../src/auth/auth.routes.js";
import { hashPassword, scryptGate, verifyPassword } from "../../src/auth/password.js";

const app = createApp();

beforeEach(async () => {
  await resetDb();
  resetAuthRateLimits();
});
afterAll(async () => { await prisma.$disconnect(); });

describe("scrypt gate", () => {
  it("never runs more than two hashes at once", async () => {
    // Sampled while the hashes are in flight, not after they resolve: by the
    // time a hash's promise settles, `active` has already been decremented and
    // the reading would be meaningless.
    const runs = Array.from({ length: 6 }, () => hashPassword("hunter2hunter2"));
    await new Promise((resolve) => setImmediate(resolve));

    expect(scryptGate.stats().active).toBe(2);
    expect(scryptGate.stats().queued).toBe(4);

    await Promise.all(runs);
    expect(scryptGate.stats().active).toBe(0);
    expect(scryptGate.stats().queued).toBe(0);
  });

  it("still verifies correctly through the gate", async () => {
    const stored = await hashPassword("hunter2hunter2");
    expect(await verifyPassword("hunter2hunter2", stored)).toBe(true);
    expect(await verifyPassword("wrong-password", stored)).toBe(false);
  });

  it("spends a hash on an unknown email, exactly as on a wrong password", async () => {
    // The enumeration defence in auth.service.ts depends on this: if the gate
    // were entered only for known users, queue wait would become the timing
    // channel that DUMMY_PASSWORD_HASH exists to close.
    const before = scryptGate.stats().total;
    await request(app).post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "hunter2hunter2" });
    expect(scryptGate.stats().total).toBe(before + 1);
  });

  it("bails out before the gate on a malformed stored hash", async () => {
    const before = scryptGate.stats().total;
    expect(await verifyPassword("hunter2hunter2", "not-a-hash")).toBe(false);
    expect(scryptGate.stats().total).toBe(before);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run test/auth/scrypt-gate.test.ts --root apps/api`
Expected: FAIL — `scryptGate` is not exported from `password.ts`.

- [ ] **Step 7: Apply the gate in `password.ts`**

Modify `apps/api/src/auth/password.ts` — add the import, the gate, and wrap both `scryptAsync` call sites. Everything else in the file is unchanged.

```ts
import { createGate } from "../lib/concurrency-gate.js";
```

```ts
/** scrypt runs on the libuv threadpool, which holds four threads and is shared
 * with Prisma's engine and every filesystem call. `login` spends a hash on
 * every anonymous request by design, so without a cap a modest burst — spread
 * across enough addresses to slip past the per-address limiter — occupies the
 * whole pool and stalls work that has nothing to do with signing in.
 *
 * Two, not four: the instance has half a vCPU, so four concurrent hashes would
 * not finish faster, they would merely finish together and leave nothing for
 * anyone else. Raising UV_THREADPOOL_SIZE was considered and rejected — more
 * threads than CPU share buys context switching, not capacity. */
export const scryptGate = createGate({
  maxConcurrent: 2,
  maxQueue: 20,
  maxWaitMs: 5000,
});
```

In `hashPassword`:

```ts
  const key = await scryptGate.run(() => scryptAsync(password, salt, KEY_BYTES, PARAMS));
```

In `verifyPassword`, leaving the two early returns above it exactly where they are:

```ts
  const key = await scryptGate.run(() =>
    scryptAsync(password, Buffer.from(saltHex, "hex"), KEY_BYTES, PARAMS),
  );
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run test/auth --root apps/api`
Expected: PASS, including the pre-existing `password.test.ts`.

- [ ] **Step 9: Run the whole API suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/lib/concurrency-gate.ts apps/api/test/lib/concurrency-gate.test.ts \
        apps/api/src/auth/password.ts apps/api/test/auth/scrypt-gate.test.ts
git commit -m "feat(auth): cap concurrent scrypt hashes"
```

---

### Task 7: Health endpoint

**Files:**
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/test/health.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `GET /healthz` → `200 { "status": "ok" }`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/test/health.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

const app = createApp();

describe("GET /healthz", () => {
  it("answers 200 without a token", async () => {
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/health.test.ts --root apps/api`
Expected: FAIL — 404.

- [ ] **Step 3: Add the route**

In `apps/api/src/app.ts`, after `app.use(express.json());` and before the `/api/auth` mount:

```ts
  // Deliberately shallow. Render uses this path both to decide when a deploy
  // goes live and to restart instances it judges unhealthy, so anything this
  // endpoint depends on becomes something that can restart the application. A
  // database check here would turn a Postgres hiccup into a restart loop that
  // outlives the hiccup. Migrations run as a pre-deploy step against the real
  // DATABASE_URL, which is what actually proves the database is reachable.
  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/health.test.ts --root apps/api`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/app.ts apps/api/test/health.test.ts
git commit -m "feat(api): add a shallow health endpoint"
```

---

### Task 8: Serve the built SPA

**Files:**
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/test/spa.test.ts`
- Create: `apps/api/test/fixtures/web-dist/index.html`
- Create: `apps/api/test/fixtures/web-dist/assets/app.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `createApp(options?: { webDistPath?: string })`. The default resolves to `apps/web/dist` relative to the module, which holds for both `src/app.ts` and the compiled `dist/app.js` because each is one directory below `apps/api`.

- [ ] **Step 1: Create the fixture**

`apps/api/test/fixtures/web-dist/index.html`:

```html
<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>AdPulse</title></head>
  <body><div id="root"></div><script type="module" src="/assets/app.js"></script></body>
</html>
```

`apps/api/test/fixtures/web-dist/assets/app.js`:

```js
export const marker = "spa-fixture";
```

- [ ] **Step 2: Write the failing test**

```ts
// apps/api/test/spa.test.ts
import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { createApp } from "../src/app.js";

const webDistPath = fileURLToPath(new URL("./fixtures/web-dist/", import.meta.url));
const app = createApp({ webDistPath });

describe("SPA serving", () => {
  it("serves index.html at the root", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain('<div id="root"></div>');
  });

  it("serves a built asset", async () => {
    const res = await request(app).get("/assets/app.js");
    expect(res.status).toBe(200);
    expect(res.text).toContain("spa-fixture");
  });

  it("falls back to index.html on a client-side route", async () => {
    // A hard refresh on /login must not 404: the SPA owns that path.
    const res = await request(app).get("/login");
    expect(res.status).toBe(200);
    expect(res.text).toContain('<div id="root"></div>');
  });

  it("falls back on a nested client-side route", async () => {
    const res = await request(app).get("/clients/some-uuid/campaigns");
    expect(res.status).toBe(200);
    expect(res.text).toContain('<div id="root"></div>');
  });

  it("answers an unknown /api path with the json envelope, not html", async () => {
    // If the fallback swallowed this, a mistyped endpoint would answer 200
    // with HTML and the frontend would read a routing mistake as a corrupt
    // response.
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Endpoint not found");
  });

  it("leaves /healthz alone", async () => {
    const res = await request(app).get("/healthz");
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("createApp without a build present", () => {
  it("mounts no static layer, so the api still behaves", async () => {
    const bare = createApp({ webDistPath: "/nonexistent/web/dist" });
    const res = await request(bare).get("/");
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run test/spa.test.ts --root apps/api`
Expected: FAIL — `createApp` takes no arguments and serves no static files.

- [ ] **Step 4: Implement in `app.ts`**

Add the imports:

```ts
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NotFoundError } from "./errors.js";
```

Add above `createApp`:

```ts
/** Resolves to `apps/web/dist` from both `apps/api/src/app.ts` and the compiled
 * `apps/api/dist/app.js`, since each sits one directory below `apps/api`. */
const DEFAULT_WEB_DIST = fileURLToPath(new URL("../../web/dist/", import.meta.url));

export interface AppOptions {
  /** Overridden by tests so the API suite never needs a real Vite build. */
  webDistPath?: string;
}
```

Change the signature and append the new layers *after* the existing routers and *before* `errorHandler` — the error handler must stay last:

```ts
export function createApp(options: AppOptions = {}) {
```

```ts
  // Anything under /api that reached this far matched no route. Answering here
  // keeps the JSON envelope, and keeps the SPA fallback below from returning
  // HTML for a mistyped endpoint.
  app.use("/api", (_req, _res, next) => {
    next(new NotFoundError("Endpoint not found"));
  });

  // In development the Vite dev server serves the SPA and proxies /api here, so
  // there is no build to serve and this whole layer stays unmounted.
  const webDistPath = options.webDistPath ?? DEFAULT_WEB_DIST;
  if (existsSync(webDistPath)) {
    app.use(express.static(webDistPath));
    // Express 5 rejects a bare "*": every wildcard needs a name.
    app.get("/*splat", (_req, res) => {
      res.sendFile(path.join(webDistPath, "index.html"));
    });
  }

  app.use(errorHandler);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/spa.test.ts --root apps/api`
Expected: PASS — 7 tests.

- [ ] **Step 6: Run the whole API suite**

Run: `npm test`
Expected: all tests pass. The new `/api` 404 changes unmatched API paths from Express's HTML 404 to the JSON envelope; if any existing test asserted the old behaviour, update it to expect `{ error: { message: "Endpoint not found" } }`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/app.ts apps/api/test/spa.test.ts apps/api/test/fixtures
git commit -m "feat(api): serve the built spa with a client-route fallback"
```

---

### Task 9: Graceful shutdown

Render sends `SIGTERM` to the old instance 60 seconds after the replacement passes its health check. Without a handler, requests in flight at that moment are severed.

**Files:**
- Create: `apps/api/src/shutdown.ts`
- Create: `apps/api/test/shutdown.test.ts`
- Modify: `apps/api/src/server.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `createShutdown(deps: ShutdownDeps): (signal: string) => Promise<void>`, where `ShutdownDeps = { server: { close(cb: (err?: Error) => void): void }; disconnect: () => Promise<void>; exit: (code: number) => void; log?: (message: string) => void }`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/test/shutdown.test.ts
import { describe, it, expect, vi } from "vitest";
import { createShutdown } from "../src/shutdown.js";

function deps(closeError?: Error) {
  return {
    server: { close: vi.fn((cb: (err?: Error) => void) => cb(closeError)) },
    disconnect: vi.fn(async () => {}),
    exit: vi.fn(),
    log: vi.fn(),
  };
}

describe("createShutdown", () => {
  it("drains the server, then disconnects, then exits 0", async () => {
    const d = deps();
    await createShutdown(d)("SIGTERM");
    expect(d.server.close).toHaveBeenCalled();
    expect(d.disconnect).toHaveBeenCalled();
    expect(d.exit).toHaveBeenCalledWith(0);
  });

  it("disconnects even when the server reports a close error", async () => {
    const d = deps(new Error("already closed"));
    await createShutdown(d)("SIGTERM");
    expect(d.disconnect).toHaveBeenCalled();
    expect(d.exit).toHaveBeenCalledWith(1);
  });

  it("ignores a second signal instead of exiting twice", async () => {
    const d = deps();
    const shutdown = createShutdown(d);
    await Promise.all([shutdown("SIGTERM"), shutdown("SIGINT")]);
    expect(d.server.close).toHaveBeenCalledTimes(1);
    expect(d.exit).toHaveBeenCalledTimes(1);
  });

  it("names the signal in its log line", async () => {
    const d = deps();
    await createShutdown(d)("SIGTERM");
    expect(d.log).toHaveBeenCalledWith(expect.stringContaining("SIGTERM"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/shutdown.test.ts --root apps/api`
Expected: FAIL — cannot resolve `../src/shutdown.js`.

- [ ] **Step 3: Implement**

```ts
// apps/api/src/shutdown.ts

export interface Drainable {
  close(callback: (error?: Error) => void): void;
}

export interface ShutdownDeps {
  server: Drainable;
  disconnect: () => Promise<void>;
  exit: (code: number) => void;
  log?: (message: string) => void;
}

/** Stops accepting connections, lets in-flight requests finish, closes the
 * database pool, and exits.
 *
 * Dependencies are injected rather than imported so this can be tested without
 * listening on a port or signalling a real process. */
export function createShutdown(deps: ShutdownDeps): (signal: string) => Promise<void> {
  const log = deps.log ?? ((message: string) => console.log(message));
  let started = false;

  return async function shutdown(signal: string): Promise<void> {
    // A second signal during the drain must not exit twice, and must not cut
    // the first drain short.
    if (started) return;
    started = true;
    log(`${signal} received, draining connections`);

    const closeError = await new Promise<Error | undefined>((resolve) => {
      deps.server.close(resolve);
    });
    if (closeError) console.error("Error while closing the server:", closeError);

    // Runs even after a close error: an open pool would keep the process alive
    // past the platform's grace period and earn a SIGKILL.
    await deps.disconnect();
    deps.exit(closeError ? 1 : 0);
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/shutdown.test.ts --root apps/api`
Expected: PASS — 4 tests.

- [ ] **Step 5: Wire it up in `server.ts`**

```ts
import "dotenv/config";
import { createApp } from "./app.js";
import { prisma } from "./lib/prisma.js";
import { createShutdown } from "./shutdown.js";

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

const server = app.listen(port, () => {
  console.log(`AdPulse API listening on http://localhost:${port}`);
});

const shutdown = createShutdown({
  server,
  disconnect: () => prisma.$disconnect(),
  exit: (code) => process.exit(code),
});

// SIGTERM is what the platform sends when a replacement instance goes live.
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
```

- [ ] **Step 6: Verify the compiled server still starts and stops cleanly**

```bash
npm run db:up
npm run build -w apps/api
cd apps/api && node dist/server.js
```

In another terminal: `curl -s localhost:3000/healthz` → `{"status":"ok"}`, then `Ctrl-C` in the first.
Expected: `SIGINT received, draining connections`, then a clean exit — no stack trace, no hang.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/shutdown.ts apps/api/test/shutdown.test.ts apps/api/src/server.ts
git commit -m "feat(api): drain in-flight requests on sigterm"
```

---

### Task 10: Production image

Replaces the development-only Dockerfile, whose `npm install` → `npm run dev` shape exists to serve the Compose bind-mounts.

**Files:**
- Create: `apps/api/Dockerfile.prod`
- Modify: `.dockerignore`

> The development image stays at `apps/api/Dockerfile` because `docker-compose.yml` references it. Phase 12 points Render at `Dockerfile.prod`.

**Interfaces:**
- Consumes: the `build` scripts of both workspaces; `apps/api/dist/server.js` from Task 9.
- Produces: an image whose default command is `node dist/server.js` with a working directory of `/app/apps/api`.

- [ ] **Step 1: Write the Dockerfile**

```dockerfile
# syntax=docker/dockerfile:1

# Debian, not Alpine. Prisma's engine resolution on musl needs an explicit
# binaryTargets, and would need two of them here: the development machine is
# arm64 and the build host is amd64. With one Debian base shared by the build
# and runtime stages, `prisma generate` resolves `native` correctly and no
# binaryTargets entry is needed at all.

FROM node:26-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci

FROM node:26-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/api ./apps/api
COPY apps/web ./apps/web
RUN npx prisma generate --schema apps/api/prisma/schema.prisma
RUN npm run build -w apps/api
RUN npm run build -w @adpulse/web

FROM node:26-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# Production dependencies first: `npm ci` empties node_modules, so a client
# copied before this step would be deleted by it.
RUN npm ci --omit=dev
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY apps/api/prisma ./apps/api/prisma
USER node
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

- [ ] **Step 2: Confirm `.dockerignore` excludes build output and secrets**

The existing file already lists `node_modules`, `apps/*/node_modules`, `dist`, `apps/*/dist`, `.env`, `.env.test`, `.git` and `docs`. Verify it is unchanged and that `.env.test` is present — the image must never carry either env file.

Run: `cat .dockerignore`
Expected: all of the above listed.

- [ ] **Step 3: Build the image**

Run:

```bash
docker build -f apps/api/Dockerfile.prod -t adpulse-api:local .
```

Expected: build succeeds. If `prisma generate` fails to find an engine, the base images of the build and runtime stages have drifted apart — they must match exactly.

- [ ] **Step 4: Run it against the Compose database**

First bring the database up and find the network Compose put it on:

```bash
npm run db:up
docker network ls --filter name=default --format '{{.Name}}'
```

Expected: a name ending in `_default` — for a checkout in `AdPulse/`, that is `adpulse_default`. Use it in the next command:

```bash
docker run --rm -p 3000:3000 \
  --network adpulse_default \
  -e DATABASE_URL="postgresql://postgres:postgres@db:5432/adpulse?schema=public" \
  -e JWT_SECRET="a-real-secret-at-least-32-characters-long" \
  -e INVITE_CODE="a-real-invite-code" \
  -e NODE_ENV=production \
  adpulse-api:local
```

Expected: `AdPulse API listening on http://localhost:3000`. A `P1001` from Prisma means the network name is wrong — the container cannot resolve the `db` hostname.

- [ ] **Step 5: Verify the image serves both halves**

```bash
curl -s localhost:3000/healthz
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/login
curl -s localhost:3000/api/does-not-exist
```

Expected: `{"status":"ok"}`; `200` for `/login`, proving the SPA fallback works from the image; and the JSON envelope for the unknown API path.

- [ ] **Step 6: Verify it refuses placeholder secrets**

```bash
docker run --rm -e NODE_ENV=production -e JWT_SECRET=dev-secret-change-me \
  -e INVITE_CODE=adpulse-invite -e DATABASE_URL="postgresql://x/y" adpulse-api:local
```

Expected: exits immediately complaining about the placeholder, from `config.ts`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/Dockerfile.prod
git commit -m "build(api): add a production image"
```

---

### Task 11: CI

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `.nvmrc` from Task 1.
- Produces: three required checks — `api`, `web`, `build` — which phase 12's `autoDeployTrigger: checksPass` will gate on.

- [ ] **Step 1: Write the workflow**

```yaml
name: CI

# No `paths:` filter, deliberately. Render's checksPass trigger counts a
# skipped check as a pass, so a path-filtered workflow would wave untested
# commits straight into production. The push-to-main run is the one that gate
# reads.
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  api:
    name: API tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          # The container's default database is the test database, which is
          # simpler than reproducing docker/postgres/init.sql — service
          # containers cannot mount files conveniently.
          POSTGRES_DB: adpulse_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    env:
      # dotenv no-ops when .env.test is absent and both test/global-setup.ts and
      # test/setup.ts fall through to process.env, so no file is generated here.
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/adpulse_test?schema=public
      # config.ts is evaluated at import time and throws without these.
      JWT_SECRET: ci-secret-not-used-outside-tests
      INVITE_CODE: ci-invite-not-used-outside-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      # npm ci does not generate the Prisma client, and there is deliberately no
      # postinstall hook: it would break `npm ci --omit=dev` in the production
      # image, where the Prisma CLI is absent.
      - run: npx prisma generate --schema apps/api/prisma/schema.prisma
      - run: npm test -w apps/api

  web:
    name: Web tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run test:web

  build:
    name: Type-check and build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npx prisma generate --schema apps/api/prisma/schema.prisma
      - run: npm run build -w apps/api
      - run: npm run build -w @adpulse/web
```

- [ ] **Step 2: Verify the three commands pass locally first**

Run:

```bash
npm run db:up
npm ci
npx prisma generate --schema apps/api/prisma/schema.prisma
npm test -w apps/api
npm run test:web
npm run build -w apps/api
npm run build -w @adpulse/web
```

Expected: all succeed. Anything that fails here fails in CI too, and is faster to debug locally.

- [ ] **Step 3: Push the branch and open a pull request**

Expected: three checks appear and go green. `web` and `build` finish first; `api` waits on the Postgres service container's health check.

- [ ] **Step 4: Verify the API job really is isolated**

Push a second commit to a second branch and open a second pull request while the first is still running.
Expected: both `api` jobs pass. Each gets its own service container, and Task 2's run-scoped schemas mean even a shared database would not let them collide.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run both suites, type-check and web build on every pr"
```

---

### Task 12: Correct the documentation

**Files:**
- Modify: `docs/superpowers/conventions.md`
- Modify: `README.md`

- [ ] **Step 1: Correct the testing section of `conventions.md`**

Replace the **Backend** bullet under `## Testing`:

```markdown
- **Backend** tests need Postgres (`docker compose up -d db`) and use the separate
  `adpulse_test` database. Each `npm test` invocation gets its own set of schemas
  (`test_run_<id>_w<N>`, one per Vitest worker), created and migrated by
  `test/global-setup.ts` before any worker starts and dropped again on teardown.
  Two runs can therefore proceed at once without wiping each other's rows. Run from
  the repository root with `npm test`.
```

The previous text claimed a `pretest` script applies the migrations. No such script exists, and none should: `global-setup.ts` already applies them to every worker schema, which a `pretest` script could not do — it would not know the schema set.

- [ ] **Step 2: Add the phase row**

In the `## Phases` table of `conventions.md`, after the Phase 10 row:

```markdown
| 11 | Production readiness + CI | [design](specs/2026-08-19-adpulse-production-readiness-design.md) | [plan](plans/2026-08-19-adpulse-production-readiness.md) |
```

- [ ] **Step 3: Document the production build in `README.md`**

Add a section after the existing running instructions:

```markdown
## Production build

The API serves both `/api` and the built SPA from one process, so a production
build has no separate frontend host and no CORS layer.

```bash
docker build -f apps/api/Dockerfile.prod -t adpulse-api .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=... -e JWT_SECRET=... -e INVITE_CODE=... -e NODE_ENV=production \
  adpulse-api
```

`NODE_ENV=production` makes the server refuse to start on the placeholder secrets
from `.env.example`. Migrations are **not** applied on boot — they run as a
pre-deploy step, so that a rolling deploy cannot mutate the schema underneath the
instance still serving traffic.

The health endpoint is `GET /healthz`.
```

- [ ] **Step 4: Verify the links resolve**

Run: `grep -o '](\.\./[^)]*' docs/superpowers/conventions.md`
Expected: every referenced path exists. Check the two new ones by hand.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/conventions.md README.md
git commit -m "docs: correct the testing section and record phase 11"
```

---

## Verification

After every task, from a clean checkout on the branch:

```bash
npm run db:up
npm ci
npx prisma generate --schema apps/api/prisma/schema.prisma
npm test          # API — 209 pre-existing plus roughly 40 new
npm run test:web  # 254, unchanged
npm run build -w apps/api
npm run build -w @adpulse/web
docker build -f apps/api/Dockerfile.prod -t adpulse-api:local .
```

Every one must pass before the branch is considered done. The web suite is expected
to be untouched by this phase: if its count or results change, something reached
further than intended.
