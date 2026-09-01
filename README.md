# AdPulse

A media buyer's dashboard. This repository hosts the backend REST API and, alongside
it in the same monorepo, the React frontend.

**Current phase:** Phase 12 — deployment to Render. Phase 11 made the repository
deployable: a single production image serving both the API and the built SPA, with CI
gating every push to `main`. CSV import and AI analysis are deliberately out of scope
for now.

## Upgrading an existing checkout

This release adds authentication, and it is **not** a drop-in upgrade for a checkout
that already has data:

- **Wipe the development database.** `Client` gains a non-null `owner_id` with no
  backfill, so the migration fails against a database that already holds clients —
  and the `api` container, which runs `prisma migrate deploy` on startup, then
  crash-loops. Run `docker compose down -v` (this drops the `adpulse_pgdata` volume),
  or `npx prisma migrate reset` inside `apps/api`.
- **Add `JWT_SECRET`** to an existing `apps/api/.env` (and to the root `.env` if you run
  the stack from Compose). The API refuses to start without it, by design — see
  [Authentication](#authentication). `INVITE_CODE` is no longer read: registration now
  redeems an invitation created by an admin.
- **Rebuild the api image _and_ renew its anonymous volumes.** This release adds the
  `jose` dependency, and Compose mounts `/app/node_modules` as an anonymous volume that
  survives recreation — so a rebuilt image alone stays masked by the old volume and the
  container exits with `Cannot find package 'jose'`. Run
  `docker compose up -d --build --renew-anon-volumes api`; the named `adpulse_pgdata`
  volume is left untouched.

## Stack

TypeScript · Express 5 · PostgreSQL 16 · Prisma · Zod · Vitest + Supertest ·
Docker Compose · npm workspaces

## Quick start

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
docker compose up --build
# In another terminal, once migrations finish:
docker compose exec api npm run seed
```

This runs the whole stack — Postgres, the API on `http://localhost:3000`, and the web
app on `http://localhost:5173`. The `api` container runs `prisma migrate deploy` on
startup, so the stack comes up fully migrated with no manual steps. Postgres data lives
in the named volume `adpulse_pgdata` and survives container restarts.

The seed command is a required first step for a fresh database: it creates the first
administrator, who can then issue invitations. It is idempotent and is safe to run again.

## Running the app

The whole stack (Postgres + API + web) runs from one command. Pick the mode that fits:

| Goal | Command |
|------|---------|
| Foreground, all logs (debug) | `npm run stack` |
| Background (detached) | `npm run stack:bg` |
| Follow background logs | `docker compose logs -f` |
| Stop the background stack | `npm run stack:down` |

These wrap `docker compose up` / `up -d` / `down`. The web container talks to the API
over the Compose network (`API_PROXY_TARGET=http://api:3000`) and enables file-watch
polling so hot reload works across the bind mount on macOS.

For the fastest frontend loop, run the API and web natively (Postgres still from
Compose) — this gives native Vite HMR:

```bash
npm run dev:all
```

`dev:all` starts Postgres (`docker compose up -d db`), then runs the API (`tsx watch`)
and the web dev server side by side with colour-prefixed logs; `Ctrl-C` stops both.
To run a single side on the host instead: `npm run dev` (API) or `npm run dev:web` (web).

See [docs/running.md](docs/running.md) for when to use each runner and the trade-offs.

## Production build

The API serves both `/api` and the built SPA from one process, so a production
build has no separate frontend host and no CORS layer.

```bash
docker build -f apps/api/Dockerfile.prod -t adpulse-api .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=... -e JWT_SECRET=... -e NODE_ENV=production \
  adpulse-api
```

`NODE_ENV=production` makes the server refuse to start on the placeholder secrets
from `.env.example`. Migrations are **not** applied on boot — they run as a
pre-deploy step, so that a rolling deploy cannot mutate the schema underneath the
instance still serving traffic.

The health endpoint is `GET /healthz`.

## Deployment

AdPulse runs on Render, in Frankfurt: one web service (Starter) serving both the
API and the built SPA, and one Basic-256mb Postgres. Both are declared in
[render.yaml](render.yaml).

### Credentials

| Credential | Where it lives | Who sets it |
|---|---|---|
| `JWT_SECRET` | Render environment variable, `sync: false` | Operator, at Blueprint creation |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Render environment variables, `sync: false` | Operator, at Blueprint creation |
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
2. Create the Blueprint in Render. It prompts for `JWT_SECRET` and the `SEED_ADMIN_*`
   values, creates the database and the service, and runs an initial deploy. This one is
   not gated by CI, by construction. Run `npm run seed -w apps/api` once against the new
   database before anyone tries to sign up — see
   [Seeding the first admin](#seeding-the-first-admin).
3. Copy the service's deploy hook URL into a GitHub Actions secret named
   `RENDER_DEPLOY_HOOK_URL`.
4. Every push to `main` from then on deploys through CI.

### Deploys after the first

Auto-deploy is off. The `Trigger deploy` job in
[ci.yml](.github/workflows/ci.yml) POSTs the hook after the checks pass, on pushes
to `main` only. If a job fails spuriously, re-running it in the Actions UI also re-runs
the deploy job. To ship when CI itself is broken, use Render's Manual Deploy button.

Migrations run as Render's pre-deploy command, `npx --no-install prisma migrate deploy`,
inside the production image. A failure aborts the deploy and leaves the previous version
serving. `--no-install` matters: without it, an image somehow missing the Prisma CLI would
silently fetch a floating latest version from the network mid-deploy instead of failing.
Because rolling deploys briefly run old and new code together, migrations must be
backward-compatible with the version already running.

### Rotating a secret

Change it in the Render dashboard; Render redeploys. Rotating `JWT_SECRET` invalidates
every access token but not the refresh tokens, which are opaque and stored in the
database, so clients recover on their next refresh without signing in again. To cut off
registration instead, revoke the outstanding invitations — there is no shared code left to
rotate.

## Project structure

```
AdPulse/
  package.json              # npm workspaces ["apps/*", "packages/*"]
  docker-compose.yml        # db (Postgres) + api
  docker/postgres/init.sql  # creates the adpulse_test database
  apps/
    api/                    # backend
      prisma/schema.prisma  # Organizations, memberships, grants, audit and business data
      src/
        composition/        # the only place adapters are constructed and wired
          app.ts            # builds the Express app (no listen) — used by tests
          server.ts         # entry point
          create-container.ts, create-routes.ts, seed-cli.ts
        modules/            # one directory per business capability
          identity/         # registration, login, tokens, profiles
          members/          # membership, roles, access grants, the session read
          invites/          # role-bearing invitations
          clients/          # clients and the contact book
          projects/         # projects under a client
          campaigns/        # campaigns, columns and the formula engine
          records/          # days and the values written into them
          audit/            # append-only event writes and scoped activity reads
        shared/             # the deliberately small kernel
          domain/           # AppError
          application/      # ActorContext, Clock, IdGenerator, UnitOfWork
          infrastructure/   # Prisma client, S3, config, clocks, ids
          presentation/     # error handling, rate limiting, request context
      test/                 # Vitest + Supertest
    web/                    # React frontend; permission-gated controls and activity log
  packages/
    access-policy/          # shared role-to-permission matrix used by API and web
  openspec/                 # change proposals, specs, designs and tasks
  docs/archive/             # superseded plans from phases 1-12
```

Request flow: HTTP → a module's presentation adapter (Zod validation) → a use case →
ports → an infrastructure adapter (Prisma, S3) → PostgreSQL. Errors surface as a
transport-independent `AppError` and are mapped to the HTTP envelope in one place.

Every client belongs to an organization. The existing business hierarchy remains
`Client → Project → Campaign → (properties, records, values)`. An active membership
provides the caller's role; `ClientAccess` grants narrow non-admin members to clients or
individual projects. Role permission and row reach are evaluated separately.

### The task board

`/tasks` is a Kanban board of work under a project. Six fixed columns, drawn left to right:
**Идея, Архив, В работе, На исправление, На проверке, Готово**. Cards are dragged between
columns and reordered within one; the move is applied to the board before the server
answers and rolled back if it is refused. Both affected columns are renumbered densely
inside one transaction, so a position is never duplicated or left with a gap.

A task belongs to exactly one project and carries a title, a rich-text description, a
priority of its own (`LOW`, `MEDIUM`, `HIGH`, `URGENT` — distinct from `ProjectPriority`,
which describes a project by counting its tasks) and optionally a responsible member.

Reading the board follows the same grants as the projects it draws from. Admins and
managers write; guests read; a `CLIENT` member is refused the board entirely, because it
carries the agency's internal notes about a customer's own work.

**Images in a description** are pasted with Ctrl+V or dropped onto the editor. They are
uploaded as they land — PNG, JPEG, WebP or GIF, up to 10 MB, recognised by their own bytes
rather than by a file name — and stored as objects; the description keeps only a reference,
so listing a board never carries image data. The editor fetches them with the member's
token and renders them from object URLs, because an `<img src>` pointing at the API would
carry no credentials. An upload whose dialog was cancelled stays recorded with no task, so
it can be found and reclaimed later.

Business mutations append an `AuditEvent` in the same database transaction as the
change. Events retain the actor's name, email and role as they were at write time and are
read through a scoped, cursor-paginated endpoint. The web app opens that history for the
organization, a project or a campaign row.

## API

Base prefix `/api`. Requests and responses are JSON.

### API architecture

The API uses a module-first Clean/Hexagonal Architecture. Business modules live under
`apps/api/src/modules/<module>` and expose their intentional application contracts only
through the module's `index.ts`. Each module may contain `domain`, `application`,
`infrastructure`, and `presentation` layers. Runtime assembly belongs exclusively to
`apps/api/src/composition`; reusable cross-module concepts belong in the deliberately
small `apps/api/src/shared` kernel.

Dependencies point inward: presentation and infrastructure may depend on application,
and application may depend on domain. Domain and application code do not import Express,
Zod, Prisma, S3 adapters, or process globals. Presentation does not import persistence,
infrastructure does not import HTTP presentation, and modules never deep-import another
module. Concrete adapters are constructed only in the composition root. An architecture test
enforces these rules, and enforces that nothing lives outside `modules/`, `shared/` and
`composition/` — the migration's legacy allow-list is now empty and stays that way.

A new module follows this template:

```text
modules/<module>/
  domain/                 # invariants and framework-free types
  application/
    ports.ts              # use-case-shaped dependency contracts
    <module>-use-cases.ts # orchestration and transaction boundaries
  infrastructure/         # Prisma, storage, crypto and other adapters
  presentation/http/      # Express handlers and Zod schemas
  index.ts                # public application surface
```

**Transactions.** A mutation that must be atomic runs inside `unitOfWork.run`, which
hands ports an opaque `TransactionContext`. Adapters exchange it for a Prisma transaction
client; application code never sees one. Audit events are appended through that same
context, so the trail and the data it describes commit or roll back together.

**Reach and role.** Which rows a member can see is translated inside each module's Prisma
adapter, from the actor's role and grants into a query filter. Which verbs their role
permits comes from `packages/access-policy`. Reach is checked first: a record the caller
cannot reach answers 404 rather than 403, so a refusal never reveals that it exists.

Use cases receive dependencies explicitly through factories. Persistence ports accept an
opaque transaction context when a mutation must be atomic; Prisma transaction clients do
not cross into application code. HTTP characterization tests protect existing routes,
payloads, statuses and authorization behavior while pure application tests use in-memory
ports, fixed clocks and deterministic identifiers.

| Method | Path | Description | Success |
|--------|------|-------------|:---:|
| POST | `/auth/register` | Register behind an invite code, returns both tokens | 201 |
| POST | `/auth/login` | Sign in, returns both tokens | 200 |
| POST | `/auth/refresh` | Exchange a refresh token for a new access token | 200 |
| POST | `/auth/logout` | Delete the refresh token | 204 |
| POST | `/clients` | Create a client | 201 |
| GET | `/clients` | List clients | 200 |
| GET | `/clients/:id` | Single client | 200 |
| PATCH | `/clients/:id` | Partial update | 200 |
| DELETE | `/clients/:id` | Delete | 204 |
| GET | `/tasks` | The board, ordered by column then position; `?projectId=` narrows it | 200 |
| POST | `/tasks` | Create a task | 201 |
| GET | `/tasks/:id` | Single task | 200 |
| PATCH | `/tasks/:id` | Partial update | 200 |
| POST | `/tasks/:id/move` | Where a drag landed: `{ column, position }` | 200 |
| DELETE | `/tasks/:id` | Delete, with its images | 204 |
| POST | `/task-images` | Upload one image pasted or dropped into a description | 201 |
| GET | `/task-images/:id` | The bytes, to whoever may read the task | 200 |
| POST | `/clients/:clientId/campaigns` | Create a campaign | 201 |
| GET | `/clients/:clientId/campaigns` | List a client's campaigns | 200 |
| GET | `/campaigns/:id` | Campaign with properties, records and totals | 200 |
| PATCH | `/campaigns/:id` | Rename or reorder | 200 |
| DELETE | `/campaigns/:id` | Delete | 204 |
| POST | `/campaigns/:id/properties` | Add a property | 201 |
| PATCH | `/properties/:id` | Rename, retype, reorder, set a formula | 200 |
| DELETE | `/properties/:id` | Delete a property | 204 |
| POST | `/campaigns/:id/records` | Add a day | 201 |
| PATCH | `/records/:id` | Move a day to another date | 200 |
| DELETE | `/records/:id` | Delete a day | 204 |
| PUT | `/records/:recordId/values/:propertyId` | Write a property value | 200 |

`name` is required on create; `niche`, `monthlyBudget` and `email` are optional.
Errors are normalized to a single shape:

```json
{ "error": { "message": "...", "details": [] } }
```

A campaign starts with eleven default properties (spend, impressions, clicks, CTR, CPM,
CPC, leads, CPL, revenue, ROAS, comment); creating a client seeds it with one such
campaign, named `Main`, at position 0. Derived properties carry a formula — an
expression tree — and are computed on read, so only hand-entered values are stored.
Numeric values cross the API as strings with four decimals to preserve precision.

The data model follows the Notion/Airtable shape rather than a spreadsheet: a campaign
has **properties** (the metric columns), **records** (the days), and a
**property value** for each hand-entered cell. Postgres tables use snake_case
(`campaign_property`, `campaign_record`, `campaign_property_value`).

Validation failures return 400, a missing record returns 404, conflicts return 409
(a duplicate date; deleting a property referenced by another property's formula;
attaching a formula to a property that already has values; changing a property's type
between text and numeric while it has values), and anything unexpected returns 500.

## Authentication

The four `/api/auth/*` endpoints above are open. **Everything else under `/api` requires
an `Authorization: Bearer <accessToken>` header** — the guard is mounted on the whole
prefix, so a route added later is protected by default.

An access token is a JWT valid for 15 minutes; a refresh token is an opaque 30-day value
stored server-side as a `sha256` digest. `POST /auth/refresh` renews the access token,
and `POST /auth/logout` deletes the refresh token so it stops working.

One environment variable is required, and the API refuses to start without it:

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Signs and verifies access tokens (HS256) |

In production, startup additionally rejects the `.env.example` placeholder and a
`JWT_SECRET` shorter than 32 characters.

### Roles and membership

A user is an identity; what they may do comes from their **membership** in the
organization, which carries exactly one role — `ADMIN`, `MANAGER`, `GUEST` or `CLIENT`.
The membership is read from the database on every request rather than sealed into the
access token, so a suspension or a demotion takes effect on the very next call instead of
when the token expires. A user with no membership, or a suspended one, is refused with
**403**.

The role decides which verbs are allowed; which rows a member can reach is a separate
question. Both are enforced, and the verb half lives in `packages/access-policy`, imported
by the API and the web app so the interface cannot offer what the API refuses.

- `ADMIN` reaches the whole organization and manages members, invitations and destructive
  operations.
- `MANAGER` works only in granted clients/projects and may create and edit business data.
- `GUEST` has read-only access to granted clients/projects.
- `CLIENT` has read-only access to the client named by their grant.

All four roles may read audit history, but the same grants constrain which events they see.

### Seeding the first admin

Registration requires an invitation, and only an admin can issue one — so a brand-new
database has to be seeded once before anybody can sign up:

```bash
SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD=... npm run seed -w apps/api
```

It reads `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` and optionally
`ORG_NAME` (which renames the migrated bootstrap organization). Running it again does
nothing once an active admin exists, so a deploy
pipeline can call it unconditionally. A database that already held accounts needs no
seeding: the tenancy migration made its oldest account the admin.

### Invitations

An admin creates an invitation, choosing the role it will grant, and passes on its code;
`POST /api/auth/register` redeems it and creates the account and its membership together.
An invitation is single use, may carry an expiry, may be bound to one email address, and
can be revoked while it is still pending.

Every rejected invitation — unknown, expired, revoked, already redeemed, addressed to
somebody else — answers with the same status and the same message, so registration cannot
be used to discover which codes exist or who was invited.

**401 versus 403 versus 404.** A missing, malformed or expired token gives **401** — the
request never reaches a service. An authenticated caller who is not an active member, or
whose role does not permit the verb, gives **403**. A resource that exists but is out of
the caller's reach gives **404**, never 403: someone else's id is indistinguishable from
an id that does not exist, so ids cannot be probed.

## Commands

Run from the repository root:

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the API in watch mode |
| `npm test` | Run the test suite |
| `npm run build` | Compile TypeScript to `dist/` |

Inside `apps/api` there are also `prisma:migrate`, `prisma:generate` and
`db:test:deploy`.

## Testing

Tests need a running Postgres — start it with `docker compose up -d db`. They use a
separate `adpulse_test` database so clearing data never touches development data;
the `pretest` script applies migrations to it automatically.

```bash
docker compose up -d db
npm test
```

## Documentation

- [CONTRIBUTING.md](CONTRIBUTING.md) — commit conventions and development workflow
- [docs/running.md](docs/running.md) — which runner to use when
- [openspec/](openspec/) — the planning workflow: one directory per change, holding its
  proposal, capability specs, design and tasks
- [openspec/specs/](openspec/specs/) — the current behaviour contract, per capability
- [docs/archive/phases-1-12/](docs/archive/phases-1-12/) — the specs and plans of phases
  1-12, kept as history and no longer the workflow
