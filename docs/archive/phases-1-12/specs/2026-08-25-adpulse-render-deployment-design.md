# AdPulse — Design (Phase 12: deployment to Render)

**Date:** 2026-08-25
**Status:** approved

> Shared context and conventions: [conventions.md](../conventions.md).

## Context

Phase 11 made the repository deployable: Express serves the built SPA from a single
origin, `/healthz` answers without touching the database, `trust proxy` is set, the
process drains on `SIGTERM`, `apps/api/Dockerfile.prod` compiles both workspaces into a
runnable image, and CI gates every pull request. Nothing was published.

This phase publishes it. AdPulse runs on **Render**, in Frankfurt, on a Hobby workspace:
one web service (Starter, 0.5 vCPU / 512 MB) serving the API and the SPA, and one
Basic-256mb Postgres, for roughly **$13.30 a month**.

The deployment work splits again along the line phase 11 established. This phase gets the
application serving on the internet and closes the two gaps that make the first deploy
riskier than it needs to be. Backups, a rehearsed restore, and the failed-deploy policy
follow in phase 13, where they can be designed against a database that exists.

## Scope

**In scope:** a committed `render.yaml` Blueprint defining the web service and the
database; migrations as a pre-deploy step; the deploy path from GitHub Actions; secret
handling; a CI job that builds and exercises the production image on amd64; a recorded
measurement of the image's resident memory; and documentation of every credential the
deployment needs.

**Out of scope, deferred to phase 13:** offsite `pg_dump` backups and their schedule, a
rehearsed restore, the failed-deploy rollback policy, deploy-outcome verification, and a
`tsconfig.test.json` so test files are type-checked.

**Out of scope, deliberately:**

- **A custom domain.** Launching on the `*.onrender.com` hostname, which carries TLS
  automatically. Adding a domain later is a `domains:` entry plus two DNS records and
  invalidates nothing built here.
- **A staging environment.** Production only; a second environment is a second $13.30.
- **A connection pooler.** See "Direct connection" below.
- **The suite flake.** A known intermittent failure affects roughly 3% of full-suite
  runs; it is unresolved and is the reason this phase does not use `autoDeployTrigger:
  checksPass`. Investigating it is not this phase's job.

## The Blueprint

`render.yaml` at the repository root, defining exactly two resources.

```yaml
services:
  - type: web
    name: adpulse
    runtime: docker
    dockerfilePath: ./apps/api/Dockerfile.prod
    dockerContext: .
    region: frankfurt
    plan: starter
    healthCheckPath: /healthz
    autoDeployTrigger: "off"
    preDeployCommand: npx prisma migrate deploy
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: adpulse-db
          property: connectionString
      - key: JWT_SECRET
        sync: false
      - key: INVITE_CODE
        sync: false

databases:
  - name: adpulse-db
    plan: basic-256mb
    region: frankfurt
    postgresMajorVersion: "16"
    databaseName: adpulse
```

**`dockerContext: .` is load-bearing.** The Dockerfile lives under `apps/api` but builds
both workspaces from the monorepo root. A context of `apps/api` fails at the first
`COPY package.json`.

**`autoDeployTrigger: "off"` is quoted deliberately** — YAML 1.1 parses the bare word
`off` as boolean `false`, which Render's schema then rejects.

**No `PORT` variable.** Render injects `PORT` (default 10000) and requires the process to
bind `0.0.0.0`. [server.ts](../../../apps/api/src/server.ts) already reads
`process.env.PORT`, and Express binds all interfaces by default, so no code changes. The
`EXPOSE 3000` in the Dockerfile is documentation; Render ignores it.

**Direct connection, not the pooled one.** Render made PgBouncer free on paid databases in
August, which resolves the question of Prisma's persistent pool against a small instance —
but the question does not arise yet. One instance on half a vCPU gives Prisma a pool of
roughly five to nine connections against a database that permits far more. Introducing the
pooler now would cost a `pgbouncer=true` parameter, the loss of prepared statements under
transaction mode, and a *second* connection string, because `prisma migrate deploy` must
never run through a pooler. That is two URLs and a subtle failure mode bought for nothing.
`connectionPoolString` is one line away if connections ever become the constraint.

**Secrets never enter the file.** `sync: false` makes Render prompt once, at Blueprint
creation. Render ignores `sync: false` variables when an existing Blueprint is updated, so
re-syncing cannot clobber a rotated secret and rotation stays a dashboard action.

## The deploy path

`autoDeployTrigger: "off"`. Deploys are triggered by a job in `.github/workflows/ci.yml`,
gated on the existing jobs.

```yaml
  deploy:
    name: Trigger deploy
    needs: [api, web, build, image]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    env:
      HOOK: ${{ secrets.RENDER_DEPLOY_HOOK_URL }}
    steps:
      - name: POST the Render deploy hook
        if: env.HOOK != ''
        run: curl -fsS -X POST "$HOOK&ref=$GITHUB_SHA"
```

**`env` is job-level, not step-level.** A step's own `env` block is not reliably visible to
that same step's `if`, and the guard needs to read `HOOK` there.

**The guard makes the job skip rather than fail.** Between merging `render.yaml` and
creating the deploy-hook secret — steps 1 and 3 of the bootstrap below — `HOOK` expands to
an empty string. Without `if: env.HOOK != ''`, `curl -fsS -X POST ""` exits non-zero and
puts a red mark on `main` for a step nobody can act on yet.

**`ref` pins the deploy to the commit CI checked.** A bare hook deploys the tracked
branch's latest commit, so a second push landing before Render dequeues the first would
build a commit whose checks never ran. Hook URLs already carry `?key=`, which is why the
separator is `&`.

**Why not `checksPass`.** The August brief chose Render's native `checksPass` trigger. Two
things changed. First, a known ~3% suite flake means a red run is sometimes meaningless,
and with `checksPass` a flaky red can leave a commit stranded — re-running a job does not
reliably re-trigger Render, so recovery is a manual deploy anyway. With a gated Actions
job, re-running the failed job also re-runs the jobs that depend on it, so the deploy
proceeds by itself. Second, `checksPass` counts a `skipped` check as a pass, which makes
any future path-filtered workflow a silent hole. Neither concern applies to an explicit
job with `needs`.

**The `if` is a security property, not a convenience.** The repository is public, so anyone
can open a pull request. GitHub does not expose secrets to fork pull requests, but the
condition makes the deploy structurally unreachable from a pull request rather than
dependent on a platform default.

**The job is named "Trigger deploy" deliberately.** The hook returns 200 with a deploy id
as soon as Render accepts the request; the build and release take minutes. A green job
means Render was asked, not that the new version is serving. Verifying the outcome requires
the Render API key — an account-scoped credential, unlike the single-service deploy hook —
and belongs with the rollback policy in phase 13. The name is what stops the job from
being read as a guarantee it does not make.

**No manual-deploy workflow.** Render's dashboard already has a Manual Deploy button, which
covers "CI is broken and I must ship" with no second workflow file and no second copy of
the secret.

### Bootstrap order

The deploy hook does not exist until the service does, which fixes the order:

1. `render.yaml` is committed and merged to `main`.
2. **Operator:** create the Blueprint in Render. It prompts for `JWT_SECRET` and
   `INVITE_CODE`, creates the database and the service, and runs an initial deploy. This
   one deploy is not gated by CI, by construction.
3. **Operator:** copy the service's deploy hook URL into a GitHub Actions secret named
   `RENDER_DEPLOY_HOOK_URL`.
4. Every subsequent push to `main` deploys through CI.

Steps 2 and 3 are operator-only and the implementation plan states them as such rather
than implying they can be automated.

## Migrations

```yaml
preDeployCommand: npx prisma migrate deploy
```

No `--schema` flag: the runtime stage sets `WORKDIR /app/apps/api` and the schema is at
`prisma/schema.prisma` relative to it, where Prisma looks by default.

**`prisma` moves from `devDependencies` to `dependencies`** in `apps/api/package.json` —
but not for the reason first supposed, and the distinction matters.

The pre-deploy command runs inside the production image, whose runtime stage installs with
`npm ci --omit=dev`. An earlier draft of this spec asserted that the CLI was therefore
absent and the first deploy would fail. **That is wrong, and it was checked rather than
assumed:** `npx --no-install prisma --version` inside the built image reports 6.19.3. The
CLI is present because `@prisma/client` — a genuine runtime dependency — declares
`"prisma": "*"` as a **peer dependency**, and npm 7+ installs peers automatically.
`--omit=dev` does not omit the peers of production dependencies.

So the move fixes no bug and changes no bytes in the image; the package is installed either
way. What it changes is the declaration. Today a command the deploy depends on is satisfied
by a transitive peer-install — an accident of npm's default behaviour and of how
`@prisma/client` happens to declare its relationship to the CLI. A `legacy-peer-deps`
setting, a package-manager change, or a restructuring upstream would remove it silently,
and the failure would surface as a broken `preDeployCommand` at deploy time. One line of
declaration converts that accident into a contract.

The enforcement is separate and lives in CI: the `image` job runs
`npx --no-install prisma migrate deploy` inside the built image on every pull request, so a
regression is caught before a deploy rather than during one. `--no-install` is what makes
that check real — without it, npx would fetch the CLI from the network and the check would
pass while the image lacked it.

The alternative — running migrations from CI against Render's external connection string —
was rejected regardless: it would put the production `DATABASE_URL` into GitHub secrets.

**Why pre-deploy rather than on boot.** Render's rolling deploys keep the old instance
serving until the replacement passes its health check, so at every deploy two processes
are briefly alive. A boot-time migration would mutate the schema underneath still-running
old code. The pre-deploy command runs once, on a separate instance, before any new
instance starts; if it fails the deploy aborts and the old version keeps serving.

This imposes the usual obligation: migrations must be backward-compatible with the
currently-running code, because there is always a window where new schema meets old code.
Expand and contract; never drop a column in the same deploy that stops using it.

## The production image in CI

A new `image` job in `ci.yml` builds `Dockerfile.prod` and then exercises it. A job that
only built would not catch a missing runtime dependency, because the build stage has the
dev dependencies and only the runtime stage does not — which is exactly the class of
defect the Prisma CLI turned out to be.

| Step | Proves |
|---|---|
| `docker build -f apps/api/Dockerfile.prod .` | the image builds on amd64 |
| `docker run … npx prisma migrate deploy` | the Prisma CLI exists in the runtime stage and migrations apply |
| `GET /healthz` → `{"status":"ok"}` | the process serves |
| `GET /login` → `200` | the SPA fallback works from inside the image |
| `GET /api/does-not-exist` → JSON envelope | unmatched API paths do not return HTML |

It runs against a Postgres service container, using the same pattern as the existing `api`
job, and on an `ubuntu-latest` runner — so it builds **amd64**, the architecture Render
runs. Phase 11 verified the image once, by hand, on arm64; this closes that gap.

## Memory

`docker stats` against the same image, locally: resident set at idle, and under a small
burst of sign-ins, since the scrypt path costs 16 MB per hash and is the memory-hungry one.
The measured numbers are recorded in the implementation plan as observed facts.

Decision rule: comfortably below ~250 MB idle means Starter is right. Approaching ~400 MB
under load means budgeting for Standard (+$18/month) before launch rather than discovering
it in production. Render's own metrics are the authority once deployed; the local figure
is a proxy taken while changing course is still cheap.

## Credentials

Documented in `README.md`, in a section beside the existing production-build instructions,
because that is where somebody looks first. Phase 13 may extract it to a dedicated
`docs/deployment.md` when the backup and restore runbooks make it too large for a README.

| Credential | Where it lives | Who sets it | Notes |
|---|---|---|---|
| `JWT_SECRET` | Render env var, `sync: false` | Operator, at Blueprint creation | ≥32 chars; startup refuses the published placeholder when `NODE_ENV=production` |
| `INVITE_CODE` | Render env var, `sync: false` | Operator, at Blueprint creation | Gates registration; startup refuses the published placeholder |
| `RENDER_DEPLOY_HOOK_URL` | GitHub Actions secret | Operator, after the service exists | Single-service scope; not an API key |
| `DATABASE_URL` | Injected by Render | Nobody | Comes from `fromDatabase`; never typed, stored, or committed |

Generating a secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

**Not required, and deliberately so:** no Render API key, no container-registry
credentials, no database password handled by a human, and no production `DATABASE_URL` in
GitHub. The deploy hook is the only credential the repository holds, and its blast radius
is one service.

**Rotation.** Changing `JWT_SECRET` in the Render dashboard triggers a redeploy and
invalidates every access token, but not the refresh tokens — those are opaque and
database-backed. Clients recover on their next refresh without re-authenticating, which is
true only because phase 11 stopped [session.ts](../../../apps/web/src/lib/auth/session.ts)
from treating every non-OK refresh as a dead session. Rotating `INVITE_CODE` costs
nothing; it is read only by `/api/auth/register`.

## Verification

This phase adds no application code beyond moving one dependency, so there is nothing to
test-drive. Verification is layered instead:

| Layer | How |
|---|---|
| The image | the CI `image` job — builds, migrates, and serves |
| The Blueprint | Render's own validation on first sync |
| Migrations | the pre-deploy step, which aborts the deploy on failure |
| The application | `GET /healthz`, a sign-in, and a client created through the deployed UI |
| Memory | `docker stats` locally, then Render's metrics |

The existing 257 API and 255 web tests must keep passing; moving `prisma` between
dependency groups must not change them.

## Risks

**The first deploy is the only ungated one.** It happens at Blueprint sync, before the hook
exists. If `preDeployCommand` fails there, it fails against an empty database — recoverable,
but diagnosed from Render's build logs rather than CI's.

**The suite flake can block a deploy.** Roughly 3% of runs go red for reasons unrelated to
the change. Recovery is re-running the failed job, which also re-runs the deploy job. The
underlying cause is unresolved and belongs to its own investigation.

**512 MB is unverified until measured.** Prisma's query engine, Node's baseline, the static
file cache and up to two 16 MB scrypt buffers share one Starter instance. The measurement
is in scope precisely because the answer changes the monthly bill.

**Backups exist but are Render's.** A paid Basic instance gets daily backups and
three-day point-in-time recovery from day one, so the window is not unprotected — but every
copy lives inside the account it protects. The offsite copy is phase 13, and until it
exists, losing account access means losing the data.
