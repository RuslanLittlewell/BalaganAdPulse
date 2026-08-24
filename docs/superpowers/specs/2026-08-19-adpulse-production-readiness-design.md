# AdPulse — Design (Phase 11: production readiness and CI)

**Date:** 2026-08-19
**Status:** approved

> Shared context and conventions: [conventions.md](../conventions.md).

## Context

Ten phases built a working, authenticated dashboard. None of it has ever run outside a
developer's machine. The API starts under `tsx watch`, the SPA is served by the Vite dev
server, `/api` reaches the backend only through that server's proxy, and the one
`Dockerfile` in the repository ends in `npm run dev`. There is no `.github/` directory:
no CI, no CD, nothing that runs on a push.

A platform decision preceded this phase. AdPulse will run on **Render**, in Frankfurt,
on a Hobby workspace: one web service (Starter, 0.5 vCPU / 512 MB) serving both the API
and the built SPA, and one Basic-256mb Postgres, for about $13.30 a month.

The deployment work splits in two along a sharp line: what lives in the repository and
can be proven by a test, and what requires a live Render account and is proven by a
deploy. This phase is the first half. It leaves `main` able to build a production image
and gate every pull request, with nothing yet published.

## Scope

**In scope:** Express serving the built SPA with a client-side-routing fallback; a health
endpoint; `trust proxy`; graceful shutdown; a real production build path (`tsc` →
`node dist/server.js`) in a multi-stage production `Dockerfile`; rate limiting and a
scrypt concurrency gate on `/api/auth/*`; GitHub Actions CI for both test suites plus
type-checking and the web production build; a single pinned Node version; run-scoped
test schemas; and a correction to the testing section of `conventions.md`.

**Out of scope, deferred to phase 12:** the `render.yaml` Blueprint, the CD path and
`autoDeployTrigger`, `preDeployCommand`, secret generation and rotation, database backups
and the restore runbook, and the failed-deploy rollback policy.

**Out of scope, deliberately:** converging the TypeScript versions. `apps/api` is on
`typescript@^7`, `apps/web` on `^5.7`. Each workspace keeps compiling with its own, and
CI makes the drift visible rather than hiding it. Converging two compiler majors is a
real change with real risk and it is not this phase's job.

## Production runtime

One process, one origin. Nothing is proxied and nothing is cross-origin, so there is no
CORS layer and no `cors` dependency.

```
Render edge ──> Express (one process, 512 MB)
                 │
                 ├─ GET /healthz            200, no dependencies
                 ├─ /api/auth/*             open, rate-limited
                 ├─ /api/*                  requireAuth
                 ├─ express.static(webDist)
                 └─ GET /*splat             index.html
```

The frontend needs no change: every request it makes is already relative — the shared
helper in [http.ts](../../../apps/web/src/lib/http.ts) prefixes `/api`, and
[session.ts](../../../apps/web/src/lib/auth/session.ts) calls `/api/auth/refresh`
directly. A single origin is what it was written for.

### Mount order

The order in `createApp` is load-bearing:

1. `/api/auth` and the guarded `/api` routers mount first.
2. `express.static` serves the built assets.
3. The SPA fallback mounts last, and **excludes `/api`**.

If the fallback caught unmatched `/api` paths, a mistyped endpoint would answer `200`
with HTML instead of the `{ error: { message } }` envelope, and the frontend would treat
a routing mistake as a corrupt response. Unmatched `/api` paths must keep falling through
to `errorHandler`.

Express 5 detail: a bare `app.get("*")` throws under path-to-regexp 8. The fallback is
written `app.get("/*splat", …)`.

### `createApp` gains one optional argument

```ts
createApp({ webDistPath }?: { webDistPath?: string })
```

It defaults to a path resolved from `import.meta.url`, and **static serving mounts only
if that directory exists**, checked once at startup. Two consequences, both wanted:

- The 209 existing API tests keep passing untouched. A test checkout has no `dist`, so
  no static layer mounts and no existing assertion changes.
- New tests point `webDistPath` at a fixture directory instead of requiring a real Vite
  build to run the API suite.

### `trust proxy` is `1`, not `true`

Render places exactly one proxy in front of the service. `app.set("trust proxy", 1)`
takes the last hop of `X-Forwarded-For` as the client address. `true` would trust the
entire chain, letting any client prepend a forged address — which would silently defeat
the per-IP limiter specified below. The limiter is only as sound as this value.

### Graceful shutdown

Render sends `SIGTERM` to the old instance 60 seconds after the replacement passes its
health check. On that signal: stop accepting connections, drain in-flight requests via
`server.close()`, then `prisma.$disconnect()`. Without it, requests in flight at deploy
time are severed.

### Health endpoint

`GET /healthz` returns `200 {"status":"ok"}` when the process is serving. No database
call, no authentication, no dependencies.

It is deliberately shallow. Render uses `healthCheckPath` both to decide when a deploy
goes live *and* to restart instances it judges unhealthy, so anything this endpoint
depends on becomes something that can restart the application. A database check here
turns a Postgres hiccup into an application restart loop that outlives the hiccup. The
gap it leaves — "process up, database unreachable" — is closed in phase 12 by
`preDeployCommand`, which runs migrations against the real `DATABASE_URL` on every
deploy and fails the deploy before any instance starts.

### Production image

A multi-stage `apps/api/Dockerfile.prod` joins the development-only `Dockerfile`, whose
`npm install` → `prisma generate` → `npm run dev` shape exists to serve the Compose
bind-mounts and is still needed by `docker-compose.yml`. Only the Node base of the
development images changes.

```
stage 1  deps     node:26-slim, npm ci from the workspace manifests
stage 2  build    tsc          → apps/api/dist
                  vite build   → apps/web/dist
                  prisma generate
stage 3  runtime  node:26-slim, NODE_ENV=production, USER node
                  npm ci --omit=dev
                  COPY generated Prisma client from stage 2
                  COPY api dist/ + web dist/ + prisma/
                  CMD ["node", "dist/server.js"]
```

Stage 3 installs production dependencies first and copies the generated client
afterwards: `npm ci` empties `node_modules`, so a client copied before it would be
deleted.

**Debian-slim, not Alpine.** Prisma's engine resolution on musl is the known-fragile part
of containerising Prisma: Alpine requires an explicit `binaryTargets`, and because the
developer machine is arm64 while Render builds amd64, it would require *two*. With build
and runtime stages sharing one Debian base, `prisma generate` resolves `native` correctly
and no `binaryTargets` entry is needed at all. The image is larger; image size does not
consume the 512 MB the instance is actually constrained by.

**No `postinstall` hook.** `npm ci` does not generate the Prisma client, and adding
`"postinstall": "prisma generate"` is the conventional fix — but it breaks
`npm ci --omit=dev`, where the Prisma CLI is absent. Generation stays an explicit step in
the build stage and in CI.

The image builds the SPA from source rather than copying a prebuilt `dist`, so CI and
Render produce identical output from identical inputs.

Migrations are absent from this image's `CMD` by design. Render's rolling deploys keep
the old instance serving until the replacement is healthy, so at every deploy two
processes are alive and a boot-time `prisma migrate deploy` would mutate the schema under
the still-running old code. Migrations move to `preDeployCommand` in phase 12.

## Protecting `/api/auth/*`

`login` runs `scrypt` for every unauthenticated request, by design:
[auth.service.ts](../../../apps/api/src/auth/auth.service.ts) verifies against
`DUMMY_PASSWORD_HASH` when the email matches no user, so an unknown address cannot be
distinguished from a wrong password by response time. That decision is correct and stays
— and it means every anonymous request to `/api/auth/login` costs one full 16 MB scrypt
hash on a libuv threadpool thread.

`register` also hashes, but checks the invite code first and throws before hashing, so it
is not an equivalent surface.

Two layers, because they stop different things.

### Layer 1 — per-IP window

`middleware/rate-limit.ts` exports `createRateLimit({ windowMs, limit })`.

| Routes | Limit |
|---|---|
| `login`, `register` | 10 per 15 min per IP |
| `refresh`, `logout` | 60 per 15 min per IP |

`login` and `register` share a single `credentialLimit` instance — not one bucket each —
so the ten attempts are pooled across both routes per IP.

`refresh` gets the higher ceiling deliberately: a signed-in SPA renews every 15 minutes
*per open tab*, so a user with several tabs is ordinary traffic.

**The store is itself an attack surface.** A `Map` keyed by client address grows without
bound under a distributed scan — a memory-exhaustion vector created by the defence
against one. Two bounds: an `unref()`-ed sweep every 60 seconds drops expired entries,
and a hard key cap refuses new keys rather than admitting them. The interval is
`unref()`-ed so it cannot hold the process open during graceful shutdown.

Being middleware at the HTTP layer, it responds directly — `429`, a `Retry-After` header,
and the standard `{ error: { message } }` envelope.

### Layer 2 — scrypt concurrency gate

The gate lives **inside `auth/password.ts`**, wrapping `hashPassword` and
`verifyPassword`, so every caller is covered by construction rather than by remembering
to call through it. This mirrors the reasoning already written into
[app.ts](../../../apps/api/src/app.ts) for mounting `requireAuth` ahead of the routes.

| Setting | Value |
|---|---|
| Concurrent hashes | 2 |
| Queue depth | 20, then `503` |
| Maximum wait | 5s, then `503` |

**Why 2 and not 4.** The libuv pool holds 4 threads and the instance is 0.5 vCPU. scrypt
is CPU-bound, so four concurrent hashes do not raise throughput — they make all four
slower while starving Prisma's engine and every `fs` call of a thread. Two leaves half
the pool for everything else. Raising `UV_THREADPOOL_SIZE` was considered and rejected:
more threads than available CPU share buys context switching, not capacity.

**The gate must not become a timing oracle.** It is entered unconditionally, before the
known/unknown-email branch, so queue wait is identical for both. This preserves the
property `DUMMY_PASSWORD_HASH` exists to protect, and it is exactly the kind of invariant
a later refactor breaks silently — so it is asserted by a test, not guarded by a comment.

### `errorHandler` gains an exposure marker

The gate sits in the service layer with no access to `res`, so it throws
`ServiceUnavailableError` (503). But [error-handler.ts](../../../apps/api/src/middleware/error-handler.ts)
maps every status ≥ 500 to a logged, generic `"Internal error"` — correct for a Prisma
error carrying absolute source paths, wrong for a deliberate backpressure signal.

Deliberate errors carry `expose = true` and an optional `retryAfter`. The handler skips
the log-and-genericise branch for those alone, and sets `Retry-After` when present.
Every unplanned error behaves exactly as it does today.

## CI

`.github/workflows/ci.yml`, triggered on pull requests targeting `main` and on pushes to
`main`.

**No `paths:` filters, anywhere.** Render's `checksPass` trigger — arriving in phase 12 —
treats a `skipped` check as a pass. A path-filtered workflow would therefore wave
untested commits straight into production. The push-to-`main` run is the one that gate
reads.

Three parallel jobs, each on `node-version-file: .nvmrc`:

| Job | Runs | Postgres |
|---|---|---|
| `api` | `npm test -w apps/api` | service container |
| `web` | `npm run test:web` | — |
| `build` | `tsc` (API) and `vite build` (web) | — |

The constraint that two `npm test` invocations must never overlap is satisfied twice
over: the `web` job never touches Postgres, and the `api` job gets a service container
private to that job, so concurrent runs cannot see each other's rows. The run-scoped
schemas below close the same hole locally.

The service container sets `POSTGRES_DB: adpulse_test` directly rather than reproducing
[init.sql](../../../docker/postgres/init.sql) — service containers cannot mount files
conveniently, and the container's default database can simply *be* the test database.

**No `.env.test` is generated.** `dotenv` no-ops when the file is absent, and both
[global-setup.ts](../../../apps/api/test/global-setup.ts) and
[setup.ts](../../../apps/api/test/setup.ts) fall through to `process.env`, so job-level
environment variables suffice. `JWT_SECRET` and `INVITE_CODE` are required too:
[config.ts](../../../apps/api/src/config.ts) evaluates at import time and throws without
them.

An explicit `prisma generate` step follows install in both jobs that need it. Without it
a fresh checkout fails `tsc` and the suite before the first assertion.

`concurrency` is grouped per ref with `cancel-in-progress`, so re-pushing a branch kills
the stale run rather than queueing it.

## Node version

One version, pinned in one place that machines read:

| Location | Value |
|---|---|
| `.nvmrc` | `26` |
| root `package.json` `engines.node` | `>=26 <27` |
| production `Dockerfile` | `node:26-slim` |
| dev `apps/api/Dockerfile`, `apps/web/Dockerfile` | `node:26-slim` (from `node:24-alpine`) |

CI reads `.nvmrc`. Node 26 rather than 24 because development already runs v26.5.1,
`@types/node` is `^26`, and [setup.ts](../../../apps/web/src/test/setup.ts) is written
against Node 26's global `localStorage` shadowing.

## Run-scoped test schemas

Worker schemas become `test_run_<id>_w<N>` instead of the fixed `test_worker_<N>`. Two
concurrent local runs currently share all four schemas, and `resetDb()` in one wipes the
other's rows mid-test.

The run id is generated in `globalSetup` and must reach the worker processes, where
`setup.ts` needs it *before* `src/lib/prisma.ts` is imported and instantiates its client.
Two mechanisms are candidates — an inherited environment variable, or Vitest's
`provide`/`inject`. The implementation determines which actually holds for
`vitest@4.1.10` empirically and records the finding, as the repository already did for
`VITEST_POOL_ID`.

`globalTeardown` drops the run's schemas. Setup additionally sweeps orphaned `test_run_*`
schemas, so a killed run leaves no litter behind.

Cost is roughly 1–3 seconds per run: `globalSetup` already spawns the Prisma CLI four
times on every run, so only the DDL is new, not the process startup.

## `conventions.md`

The Testing section claims a `pretest` script applies test migrations. No such script
exists in `apps/api/package.json`, and none should: `global-setup.ts` already applies
migrations to every worker schema before any worker starts, which a `pretest` script
could not do, since it would not know the schema set. The claim is corrected rather than
implemented. The section also picks up the run-scoped schemas, and the phase table gains
a Phase 11 row.

## Testing strategy

Every task is test-first.

| Area | Covered by |
|---|---|
| SPA fallback | supertest against a fixture `webDistPath`: `/login` returns `index.html`; unknown `/api/*` still returns the JSON envelope; a real asset is served |
| `createApp` compatibility | the existing 209 tests, unchanged, with no `dist` present |
| `/healthz` | supertest: 200, correct body, reachable without a token |
| `trust proxy` | one forwarded hop is honoured; a forged longer chain is not |
| Graceful shutdown | `SIGTERM` drains in-flight requests and disconnects Prisma |
| Rate limiter | window boundaries under fake timers, per-IP separation, 429 shape and `Retry-After`, expired-entry sweep, key cap |
| scrypt gate | never more than 2 concurrent, queue admits to 20, 503 past depth, 503 on timeout, and identical timing for known and unknown emails |
| `errorHandler` | `expose` errors keep their message and set `Retry-After`; unplanned errors still genericise and log |
| Run-scoped schemas | two simultaneous runs do not observe each other's rows; teardown drops its schemas |

The production image is verified by building it and starting the container against the
Compose database — the one item here whose proof is an observed run rather than an
assertion.

## Risks

**512 MB is the binding constraint, not the price.** Prisma's query engine, Node's
baseline, the static file cache and up to two 16 MB scrypt buffers share one Starter
instance. The measurement belongs in this phase, while changing course is still cheap:
if resident memory does not fit, the next Render rung is $25 and the platform maths from
the decision brief shifts.

**Rate limits are per IP, so a shared NAT shares a bucket.** Ten logins per 15 minutes is
generous for a handful of users and tight for an office behind one gateway. It is the
first number to revisit if AdPulse grows a team.

**The dev and production images diverge.** The production `Dockerfile` is new and Compose
keeps its own. The Node bases are pinned together, but nothing forces the rest to stay in
step, and a divergence surfaces only at deploy time.

**The rate limiter counts a request before the handler runs.** `credentialLimit` sits
ahead of `controller.login` in the middleware chain, so it increments on every request
that reaches the route — including one the scrypt concurrency gate later sheds with a
503. During a saturation spike, honest retries against `login` can exhaust the ten-attempt
window entirely on 503s, with no password ever actually checked. Recorded here as a known
trade-off, not fixed in this phase.
