# Render Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put AdPulse on the internet: a committed `render.yaml` Blueprint, migrations as a pre-deploy step, a CI-gated deploy, and a CI job that proves the production image actually runs.

**Architecture:** One Render web service (Docker runtime, built from `apps/api/Dockerfile.prod`) serves the API and the built SPA from a single origin, alongside one Basic-256mb Postgres — both declared in `render.yaml`. Render's auto-deploy is off; a job in GitHub Actions, gated on the test jobs, POSTs a deploy hook. Migrations run as Render's `preDeployCommand` inside the production image, which requires the Prisma CLI to be a runtime dependency.

**Tech Stack:** Render Blueprints (`render.yaml`), Docker (multi-stage, `node:26-slim`), GitHub Actions, Prisma 6, PostgreSQL 16.

**Spec:** [docs/superpowers/specs/2026-08-25-adpulse-render-deployment-design.md](../specs/2026-08-25-adpulse-render-deployment-design.md)

## Global Constraints

- **English only** — code, comments, docs, commit messages.
- **Conventional Commits** — `type(scope): subject`, imperative, lowercase, no trailing period. **One line only — no body, no second `-m`.**
- **No new dependencies.** Moving `prisma` between dependency groups is not a new dependency; nothing else is added.
- Region is exactly `frankfurt`. Database plan is exactly `basic-256mb`. `postgresMajorVersion` is exactly `"16"`.
- `autoDeployTrigger` is exactly `off`.
- `preDeployCommand` is exactly `npx prisma migrate deploy` — no `--schema` flag.
- `healthCheckPath` is exactly `/healthz`.
- Secrets are declared `sync: false` and **never** given a value in the file.
- The deploy job runs only on `push` to `main`, never on `pull_request`.
- All 257 API tests and 255 web tests must keep passing.
- **Do not `git push`, do not open a pull request, do not create anything in Render.** Those are the operator's actions.
- Run tests from the repository root: `npm test` and `npm run test:web`. Focused API runs need cwd `apps/api` (`cd apps/api && npx vitest run <file>`); `--root apps/api` from the repo root does not work.

## File Structure

| File | Responsibility |
|---|---|
| `apps/api/package.json` | Moves `prisma` to `dependencies` so the CLI exists in the runtime image |
| `package-lock.json` | Regenerated to match the dependency-group change |
| `render.yaml` | The Blueprint: one web service, one database (new, repo root) |
| `.github/workflows/ci.yml` | Gains an `image` job and a `deploy` job |
| `README.md` | Deployment section: credentials table and bootstrap order |
| `docs/superpowers/conventions.md` | Phase 12 row in the phase table |

## Notes that will save you time

- **Networking differs between CI and your machine, and the plan uses each idiom where it belongs.**
  - *In the CI workflow:* a GitHub service container is reachable at `localhost:5432` from the *job*, but a container started with `docker run` has its own loopback. So every `docker run` in the `image` job uses `--network host`, which on an `ubuntu-latest` runner shares the runner's network namespace, making both `localhost:5432` and `localhost:3000` resolve.
  - *On your machine (macOS):* `--network host` is not reliably available in Docker Desktop. Local commands therefore attach to the Compose network instead — `--network adpulse_default` with the database at `db:5432`, and `-p 3000:3000` to reach the app. Confirm the network name with `docker network ls --filter name=default --format '{{.Name}}'`. **Do not "fix" the workflow to match the local form; `--network host` is correct there.**
- **A wrong-password login still costs a full scrypt hash.** `login` verifies against a dummy hash when the email matches no user, as an anti-enumeration measure. That makes it a load generator for the memory measurement with no user setup at all.
- **Docker builds are slow.** Give them a generous timeout and do not read a tool timeout as a build failure.

---

### Task 1: Declare the Prisma CLI as a runtime dependency

`preDeployCommand` runs `npx prisma migrate deploy` inside the production image, whose runtime stage installs with `npm ci --omit=dev`.

**This task is not a bug fix, and the plan originally claimed it was.** The CLI is already present in the image: `@prisma/client` is a runtime dependency and declares `"prisma": "*"` as a **peer dependency**, and npm 7+ auto-installs peers — `--omit=dev` does not omit the peers of production dependencies. Verified before this task was written: `npx --no-install prisma --version` inside the built image reports 6.19.3.

What this task changes is the *declaration*, not the bytes. A command the deploy depends on is currently satisfied by an accident of npm's default peer behaviour; a `legacy-peer-deps` setting or an upstream restructuring would remove it silently and break `preDeployCommand` at deploy time. One line converts the accident into a contract. Expect **no image size change** — if you see one, say so, because it would mean the premise above is wrong.

**Files:**
- Modify: `apps/api/package.json`
- Modify: `package-lock.json` (regenerated, not hand-edited)

**Interfaces:**
- Consumes: nothing.
- Produces: a production image in which `npx prisma migrate deploy` runs, with `prisma` explicitly declared. Task 2 measures that image; Task 4 asserts the CLI's presence in CI on every pull request, which is the actual enforcement.

- [ ] **Step 1: Record the starting state**

```bash
docker build -f apps/api/Dockerfile.prod -t adpulse-api:before .
docker run --rm adpulse-api:before npx --no-install prisma --version
docker images --format '{{.Repository}}:{{.Tag}} {{.Size}}' | grep adpulse-api:before
```

Expected: the version prints (6.19.3), because of the peer install described above. Record the version output and the image size — the size is the baseline for Step 7.

Note the `--no-install` flag: without it npx would fetch the CLI from the network and the check would pass regardless of what the image contains. Keep it on every `npx` in this task.

- [ ] **Step 2: Move the dependency**

In `apps/api/package.json`, remove `"prisma": "^6.19.3"` from `devDependencies` and add it to `dependencies`, keeping both objects alphabetically ordered:

```json
  "dependencies": {
    "@prisma/client": "^6.19.3",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "jose": "^6.2.8",
    "prisma": "^6.19.3",
    "zod": "^4.4.3"
  },
```

- [ ] **Step 3: Regenerate the lockfile**

Run: `npm install`
Expected: `package-lock.json` changes (the `dev` markers for `prisma` and its transitive packages). Do not edit the lockfile by hand.

- [ ] **Step 4: Confirm the CLI is still present, now by declaration**

```bash
docker build -f apps/api/Dockerfile.prod -t adpulse-api:after .
docker run --rm adpulse-api:after npx --no-install prisma --version
docker run --rm --entrypoint sh adpulse-api:after -c 'ls -d /app/node_modules/prisma'
```

Expected: prints the Prisma CLI version (6.19.3) and the package directory. This should match Step 1 exactly — the point of the change is that it is now guaranteed rather than incidental, not that it newly works.

- [ ] **Step 5: Prove migrations actually run inside the image**

```bash
npm run db:up
docker network ls --filter name=default --format '{{.Name}}'   # expect adpulse_default
docker run --rm --network adpulse_default \
  -e DATABASE_URL="postgresql://postgres:postgres@db:5432/adpulse?schema=public" \
  adpulse-api:after npx --no-install prisma migrate deploy
```

Expected: Prisma reports the migrations as applied or already applied, and exits 0. This is the command Render will run — the only difference is the network and host, which are local concerns.

- [ ] **Step 6: Verify nothing else broke**

Run: `npm test && npm run test:web`
Expected: 257 API tests and 255 web tests pass.

- [ ] **Step 7: Confirm the image size did not change**

Run: `docker images --format '{{.Repository}}:{{.Tag}} {{.Size}}' | grep adpulse-api`
Report both `:before` and `:after`. They should be the same, because the package was already installed as a peer. **A meaningful increase means the premise in this task's preamble is wrong — report that as a concern rather than shrugging it off.**

- [ ] **Step 8: Commit**

```bash
git add apps/api/package.json package-lock.json
git commit -m "build(api): declare the prisma cli as a runtime dependency"
```

---

### Task 2: Measure the image's memory

The spec commits Starter (512 MB) on an untested assumption. This records the real number while changing course is still cheap.

**Files:** none changed. The deliverable is measurements written into the report.

**Interfaces:**
- Consumes: the image from Task 1.
- Produces: two numbers — idle RSS and RSS under sign-in load — and a recommendation of `starter` or `standard`, which Task 3 writes into `render.yaml`.

- [ ] **Step 1: Start the database and the image**

If Task 1's `adpulse-api:after` image is no longer present (`docker images | grep adpulse-api`), rebuild it first with `docker build -f apps/api/Dockerfile.prod -t adpulse-api:after .`.

```bash
npm run db:up
docker run -d --name adpulse-mem --network adpulse_default -p 3000:3000 \
  -e DATABASE_URL="postgresql://postgres:postgres@db:5432/adpulse?schema=public" \
  -e JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")" \
  -e INVITE_CODE="measurement-only" \
  -e NODE_ENV=production -e PORT=3000 \
  adpulse-api:after
sleep 5
curl -s localhost:3000/healthz
```

Expected: `{"status":"ok"}`.

- [ ] **Step 2: Record idle memory**

```bash
docker stats --no-stream --format '{{.Name}} {{.MemUsage}} {{.MemPerc}}' adpulse-mem
```

Record the figure. Take it twice, thirty seconds apart, and record both.

- [ ] **Step 3: Generate scrypt load**

A wrong-password login runs a full 16 MB scrypt hash by design — the anti-enumeration measure in `auth.service.ts` verifies against a dummy hash when no user matches — so this needs no user setup at all.

The per-IP limiter allows only ten attempts per fifteen minutes, and a 429 is rejected *before* the handler runs, so it costs no hash. Vary `X-Forwarded-For` per batch to stay under the limit on each key and actually push hashes through:

```bash
for batch in 1 2 3 4 5 6; do
  for i in $(seq 1 8); do
    curl -s -o /dev/null -X POST localhost:3000/api/auth/login \
      -H 'Content-Type: application/json' \
      -H "X-Forwarded-For: 203.0.113.$batch" \
      -d '{"email":"nobody@example.com","password":"hunter2hunter2"}' &
  done
done
wait
```

That is 48 hashes against a gate that admits two at a time, so the queue stays occupied throughout — which is the state worth measuring.

- [ ] **Step 4: Record memory under load**

Run `docker stats --no-stream …` again, during and immediately after the load loop. Record the peak you observe.

- [ ] **Step 5: Clean up**

```bash
docker rm -f adpulse-mem
```

- [ ] **Step 6: Make the recommendation**

Apply the spec's rule and state the conclusion explicitly in your report:

- comfortably below ~250 MB idle → `plan: starter` is right
- approaching ~400 MB under load → recommend `plan: standard` (+$18/month) and say so plainly

There is no commit for this task; the deliverable is the recorded numbers and the recommendation.

---

### Task 3: The Blueprint

**Files:**
- Create: `render.yaml` (repository root)

**Interfaces:**
- Consumes: Task 2's plan recommendation.
- Produces: the Blueprint the operator syncs in Render. Task 5's deploy job assumes `autoDeployTrigger: off`.

- [ ] **Step 1: Write `render.yaml`**

Use `plan:` for the web service as recommended by Task 2 — `starter` unless Task 2 said otherwise.

```yaml
# The Blueprint Render syncs to create and update this project's resources.
#
# Auto-deploy is off on purpose: a job in .github/workflows/ci.yml POSTs the
# service's deploy hook after the test jobs pass. Render's own `checksPass`
# trigger counts a skipped check as a pass, and a flaky red can strand a commit
# with no way to re-trigger from CI.
services:
  - type: web
    name: adpulse
    runtime: docker
    # The Dockerfile lives under apps/api but builds both workspaces, so the
    # build context has to be the monorepo root.
    dockerfilePath: ./apps/api/Dockerfile.prod
    dockerContext: .
    region: frankfurt
    plan: starter
    healthCheckPath: /healthz
    autoDeployTrigger: off
    # Runs after the build and before any new instance starts, on a separate
    # instance. Rolling deploys keep the old instance serving until the new one
    # is healthy, so a migration on boot would alter the schema underneath code
    # that is still running. A failure here aborts the deploy and leaves the
    # old version serving.
    preDeployCommand: npx prisma migrate deploy
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: adpulse-db
          property: connectionString
      # sync: false means Render prompts once at Blueprint creation and then
      # ignores these on later syncs, so re-syncing cannot clobber a rotated
      # secret. The values never appear in this file.
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

- [ ] **Step 2: Verify the YAML parses**

```bash
python3 -c "import yaml; d=yaml.safe_load(open('render.yaml')); print('PARSED OK'); print('service:', d['services'][0]['name'], d['services'][0]['plan'], d['services'][0]['region']); print('autoDeploy:', d['services'][0]['autoDeployTrigger']); print('db:', d['databases'][0]['plan'], d['databases'][0]['postgresMajorVersion'])"
```

Expected: `PARSED OK`, then the values printed back matching the Global Constraints exactly.

Note: `autoDeployTrigger: off` — confirm it prints as the string `off` and not as boolean `False`. YAML 1.1 parsers treat bare `off` as a boolean. If it prints `False`, quote it as `"off"` and re-run.

- [ ] **Step 3: Check every referenced path exists**

```bash
ls apps/api/Dockerfile.prod
grep -n "healthz" apps/api/src/app.ts
```

Expected: the Dockerfile exists, and `/healthz` is a real route.

- [ ] **Step 4: Commit**

```bash
git add render.yaml
git commit -m "feat: add the render blueprint"
```

---

### Task 4: Build and exercise the production image in CI

A job that only ran `docker build` would not have caught Task 1's missing CLI, because the build stage has the dev dependencies and only the runtime stage does not. This job exercises the runtime stage.

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `apps/api/Dockerfile.prod`, and Task 1's runtime Prisma CLI.
- Produces: a job named `image`, which Task 5's `deploy` job lists in `needs`.

- [ ] **Step 1: Add the job**

Append to the `jobs:` block in `.github/workflows/ci.yml`, matching the existing indentation:

```yaml
  image:
    name: Production image
    runs-on: ubuntu-latest
    timeout-minutes: 15
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: adpulse
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    steps:
      - uses: actions/checkout@v4

      - name: Build the production image
        run: docker build -f apps/api/Dockerfile.prod -t adpulse-api:ci .

      # --network host throughout: a container started with `docker run` has its
      # own loopback and cannot reach the service container via localhost.
      - name: Apply migrations from inside the image
        run: |
          docker run --rm --network host \
            -e DATABASE_URL="postgresql://postgres:postgres@localhost:5432/adpulse?schema=public" \
            adpulse-api:ci npx --no-install prisma migrate deploy

      - name: Start the image
        run: |
          docker run -d --name adpulse-ci --network host \
            -e DATABASE_URL="postgresql://postgres:postgres@localhost:5432/adpulse?schema=public" \
            -e JWT_SECRET="ci-image-check-secret-at-least-32-chars" \
            -e INVITE_CODE="ci-image-check-invite" \
            -e NODE_ENV=production \
            -e PORT=3000 \
            adpulse-api:ci
          for i in $(seq 1 30); do
            curl -fsS localhost:3000/healthz >/dev/null 2>&1 && break
            sleep 1
          done

      - name: The process serves
        run: |
          test "$(curl -fsS localhost:3000/healthz)" = '{"status":"ok"}'

      - name: The SPA fallback works from inside the image
        run: |
          test "$(curl -s -o /dev/null -w '%{http_code}' localhost:3000/login)" = "200"

      - name: An unmatched API path returns the json envelope, not html
        run: |
          curl -s localhost:3000/api/does-not-exist | grep -q '"error"'

      - name: Container logs on failure
        if: failure()
        run: docker logs adpulse-ci

      - name: Clean up
        if: always()
        run: docker rm -f adpulse-ci || true
```

- [ ] **Step 2: Verify the YAML parses and the job is registered**

```bash
python3 -c "import yaml; d=yaml.safe_load(open('.github/workflows/ci.yml')); print('PARSED OK'); print('jobs:', list(d['jobs'].keys()))"
```

Expected: `PARSED OK` and `jobs: ['api', 'web', 'build', 'image']`.

- [ ] **Step 3: Run the job's commands locally**

The runner cannot be invoked here, so run the same sequence by hand, using the **local** networking idiom from the notes at the top of this plan. Postgres from Compose stands in for the service container:

```bash
npm run db:up
docker build -f apps/api/Dockerfile.prod -t adpulse-api:ci .
docker run --rm --network adpulse_default \
  -e DATABASE_URL="postgresql://postgres:postgres@db:5432/adpulse?schema=public" \
  adpulse-api:ci npx --no-install prisma migrate deploy
docker run -d --name adpulse-ci --network adpulse_default -p 3000:3000 \
  -e DATABASE_URL="postgresql://postgres:postgres@db:5432/adpulse?schema=public" \
  -e JWT_SECRET="ci-image-check-secret-at-least-32-chars" \
  -e INVITE_CODE="ci-image-check-invite" \
  -e NODE_ENV=production -e PORT=3000 \
  adpulse-api:ci
sleep 5
curl -fsS localhost:3000/healthz
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/login
curl -s localhost:3000/api/does-not-exist
docker rm -f adpulse-ci
```

Expected, in order: `{"status":"ok"}`, `200`, and a JSON body containing `"error"`.

This proves the image behaves; it does not prove the workflow's `--network host` form, which cannot be exercised off a Linux runner. Say so plainly in your report rather than implying the job itself was tested.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: build and exercise the production image"
```

---

### Task 5: The deploy job

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: the `api`, `web`, `build` and `image` jobs.
- Produces: a `deploy` job gated on all four. Requires the operator to add a `RENDER_DEPLOY_HOOK_URL` repository secret, which does not exist yet — the job is inert until then.

- [ ] **Step 1: Add the job**

Append to the `jobs:` block:

```yaml
  deploy:
    # "Trigger" is literal: the hook returns as soon as Render accepts the
    # request, while the build and release take minutes. A green job here means
    # Render was asked, not that the new version is serving. Verifying the
    # outcome needs the account-scoped Render API key and belongs with the
    # rollback policy in a later phase.
    name: Trigger deploy
    needs: [api, web, build, image]
    # Never on a pull request. The repository is public, so anyone can open one;
    # GitHub withholds secrets from fork pull requests, but this makes the
    # deploy structurally unreachable rather than dependent on that default.
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: POST the Render deploy hook
        run: curl -fsS -X POST "$HOOK"
        env:
          HOOK: ${{ secrets.RENDER_DEPLOY_HOOK_URL }}
```

- [ ] **Step 2: Verify the structure**

```bash
python3 -c "
import yaml
d = yaml.safe_load(open('.github/workflows/ci.yml'))
dep = d['jobs']['deploy']
print('jobs:', list(d['jobs'].keys()))
print('needs:', dep['needs'])
print('if:', dep['if'])
missing = [n for n in dep['needs'] if n not in d['jobs']]
print('needs referring to jobs that do not exist:', missing or 'none')
"
```

Expected: five jobs; `needs` is `['api', 'web', 'build', 'image']`; the `if` contains both `push` and `refs/heads/main`; no missing job references.

- [ ] **Step 3: Confirm no secret is echoed**

```bash
grep -n "RENDER_DEPLOY_HOOK_URL" .github/workflows/ci.yml
```

Expected: exactly one occurrence, inside an `env:` block. The URL must never appear in a `run:` line where it could be printed — `curl -fsS -X POST "$HOOK"` keeps it out of the logs, and `-f` makes a non-2xx response fail the job.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: trigger a render deploy after the checks pass"
```

---

### Task 6: Document the credentials and the bootstrap

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/conventions.md`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the deployment section to `README.md`**

Insert directly after the existing "Production build" section:

```markdown
## Deployment

AdPulse runs on Render, in Frankfurt: one web service (Starter) serving both the
API and the built SPA, and one Basic-256mb Postgres. Both are declared in
[render.yaml](render.yaml).

### Credentials

| Credential | Where it lives | Who sets it |
|---|---|---|
| `JWT_SECRET` | Render environment variable, `sync: false` | Operator, at Blueprint creation |
| `INVITE_CODE` | Render environment variable, `sync: false` | Operator, at Blueprint creation |
| `RENDER_DEPLOY_HOOK_URL` | GitHub Actions repository secret | Operator, after the service exists |
| `DATABASE_URL` | Injected by Render from the database | Nobody |

`JWT_SECRET` must be at least 32 characters, and the server refuses to start on the
placeholder from `.env.example` when `NODE_ENV=production`. Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Deliberately **not** required: no Render API key, no container registry credentials,
no database password handled by a person, and no production `DATABASE_URL` in GitHub.
The deploy hook is the only credential this repository holds, and it reaches exactly
one service.

### First deploy

The deploy hook does not exist until the service does, so the order is fixed:

1. Merge `render.yaml` to `main`.
2. Create the Blueprint in Render. It prompts for `JWT_SECRET` and `INVITE_CODE`,
   creates the database and the service, and runs an initial deploy. This one is not
   gated by CI, by construction.
3. Copy the service's deploy hook URL into a GitHub Actions secret named
   `RENDER_DEPLOY_HOOK_URL`.
4. Every push to `main` from then on deploys through CI.

### Deploys after the first

Auto-deploy is off. The `Trigger deploy` job in
[ci.yml](.github/workflows/ci.yml) POSTs the hook after the test jobs pass, on pushes
to `main` only. If a job fails spuriously, re-running it in the Actions UI also re-runs
the deploy job. To ship when CI itself is broken, use Render's Manual Deploy button.

Migrations run as Render's pre-deploy command, `npx prisma migrate deploy`, inside the
production image. A failure aborts the deploy and leaves the previous version serving.
Because rolling deploys briefly run old and new code together, migrations must be
backward-compatible with the version already running.

### Rotating a secret

Change it in the Render dashboard; Render redeploys. Rotating `JWT_SECRET` invalidates
every access token but not the refresh tokens, which are opaque and stored in the
database, so clients recover on their next refresh without signing in again. Rotating
`INVITE_CODE` affects only registration.
```

- [ ] **Step 2: Add the phase row to `conventions.md`**

In the `## Phases` table, after the Phase 11 row:

```markdown
| 12 | Deployment to Render | [design](specs/2026-08-25-adpulse-render-deployment-design.md) | [plan](plans/2026-08-25-adpulse-render-deployment.md) |
```

- [ ] **Step 3: Verify every link resolves**

```bash
ls render.yaml .github/workflows/ci.yml
ls docs/superpowers/specs/2026-08-25-adpulse-render-deployment-design.md
ls docs/superpowers/plans/2026-08-25-adpulse-render-deployment.md
```

Expected: all four exist. The spec and plan are untracked until committed; note that in your report if `git status` still shows them as `??`.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/superpowers/conventions.md
git commit -m "docs: document deployment credentials and the first deploy"
```

---

## Verification

From a clean checkout on the branch, with Docker running:

```bash
npm run db:up
npm ci
npx prisma generate --schema apps/api/prisma/schema.prisma
npm test          # 257
npm run test:web  # 255
npm run build -w apps/api
npm run build -w @adpulse/web
docker build -f apps/api/Dockerfile.prod -t adpulse-api:verify .
docker run --rm --network adpulse_default \
  -e DATABASE_URL="postgresql://postgres:postgres@db:5432/adpulse?schema=public" \
  adpulse-api:verify npx --no-install prisma migrate deploy
python3 -c "import yaml; yaml.safe_load(open('render.yaml')); yaml.safe_load(open('.github/workflows/ci.yml')); print('both parse')"
```

Every one must pass. Nothing in this plan pushes, opens a pull request, or creates
anything in Render — those remain the operator's actions.
