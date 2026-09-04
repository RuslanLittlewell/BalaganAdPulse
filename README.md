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

**After changing `schema.prisma`, restart the `api` container** — `docker compose restart
api`. It regenerates the Prisma client and applies migrations on start, but a container
that is already running keeps the client it generated last time. Running `prisma generate`
on the host does not help: the container's `node_modules` is its own volume, so a client
generated outside it is not the one it loads. The symptom is a 500 with
`Unknown argument` naming the column you just added. The same is true of a newly installed
dependency, which additionally needs `docker compose up -d --build --renew-anon-volumes`
to reach the container at all.

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
          campaigns/        # the campaign hierarchy and its measured figures
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

Every client belongs to an organization. The business hierarchy is
`Client → Project → Campaign → Ad set → Ad`, with measured figures stored per day at
each of the last three levels. An active membership
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

It may also name **one campaign of its own project**. Naming none means the work is about
the project as a whole, shown as **Общий** — a statement rather than a gap, so nothing
defaults a task onto a campaign. A campaign under another project is refused with 400,
the same answer an unknown campaign gets, so a refusal never confirms what exists outside
the caller's grants. Moving a task to another project releases a campaign the request did
not re-state, and deleting a campaign leaves its tasks standing as Общий: work outlives
the campaign it was about.

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

The board is not the only place work is visible. A **project** lists the tasks under it
that are still in flight — `IDEA`, `IN_PROGRESS`, `NEEDS_FIX`, `IN_REVIEW`, everything
but the two terminal stages — below its campaigns. A **campaign** lists the tasks naming
it, at every stage, because its finished work is part of its history. Opening one from
either list shows it read-only: the same description renderer the editor uses, with input
turned off, and no control that writes. Those screens are for reading; the board is where
work is managed.

The task listing accepts `projectId` and `campaignId`; both narrow what the caller's
grants already allow and neither can widen it.

The board is shared work, so it updates live. A committed task change is published to
`/api/realtime`, a WebSocket sharing the HTTP server and authenticated by the same HttpOnly
session cookie as the REST API — the browser attaches it to the upgrade request, so no token
is sent by the page or written into a URL. Delivery is decided per event and per connection,
in the order the REST path uses: organization, then the `task.read` verb, then project reach.
A member who cannot reach a task receives nothing about it, which is the socket's equivalent
of the 404 the REST path gives instead of a 403. Entitlement is re-resolved for every event
rather than captured at connect time, so a revoked grant takes effect on the next event
instead of whenever the socket happens to reconnect.

Because other members' changes arrive on their own, the board does not refetch after a move;
the mutation's response is authoritative. A dropped connection is retried with a widening
delay and refetches the board once on reconnecting, which is what covers events published
while it was down — they are not replayed.

The connection registry is in-process, so this is correct for a single API instance. Running
more than one would leave a member connected to instance A unaware of a change committed
through instance B; a shared broker (Postgres `LISTEN/NOTIFY` is the smallest step) is needed
before the board can be trusted across instances. Until then the board still converges on
reconnect and on reload.

Business mutations append an `AuditEvent` in the same database transaction as the
change. Events retain the actor's name, email and role as they were at write time and are
read through a scoped, cursor-paginated endpoint. The web app opens that history for the
organization, a project or a campaign row.

## API

Base prefix `/api`. Requests and responses are JSON.

The surface below is published by the API itself. **`GET /api/docs`** renders it for
reading and for trying requests against the running server, and `GET /api/openapi.json`
is the same description as an OpenAPI 3.1 document. Both answer without a session. Request
bodies and query parameters in it are converted from the Zod schemas the endpoints
validate with, and a test compares the description against the routers Express actually
mounts, so neither can drift from the other. `API_DOCS=off` withdraws both.

### API architecture

The API uses a module-first Clean/Hexagonal Architecture. Business modules live under
`apps/api/src/modules/<module>` and expose their intentional application contracts only
through the module's `index.ts`. Each module may contain `domain`, `application`,
`infrastructure`, and `presentation` layers. Runtime assembly belongs exclusively to
`apps/api/src/composition`; reusable cross-module concepts belong in the deliberately
small `apps/api/src/shared` kernel.

The kernel is reached through the `#shared/*` subpath import rather than a chain of
`../`: it maps to `src/shared/` for `tsx` and Vitest, and the `compiled` condition points
the built server at `dist/shared/`, which is why `npm start` and the production image run
`node --conditions=compiled`. Everything else stays relative on purpose — the architecture
test reads those specifiers to enforce the rules below.

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
| GET | `/projects/:id/campaigns` | A project's campaigns, each with its figures | 200 |
| GET | `/projects/:id/summary` | The project's figures, summed | 200 |
| GET | `/projects/:id/daily` | The project's measured days | 200 |
| GET | `/campaigns/:id` | One campaign with its figures | 200 |
| GET | `/campaigns/:id/ad-sets` | Its ad sets, each with its figures | 200 |
| GET | `/campaigns/:id/daily` | Its measured days, unsummed | 200 |
| GET | `/ad-sets/:id/ads` | An ad set's ads, each with its figures | 200 |
| GET | `/summary` | Every project the caller reaches, summed | 200 |
| GET | `/summary/channels` | The same, split by channel | 200 |

Every reading above is scoped to a range: `?from=YYYY-MM-DD&to=YYYY-MM-DD`, both
endpoints included and both required.

`name` is required on create; `niche`, `monthlyBudget` and `email` are optional.
Errors are normalized to a single shape:

```json
{ "error": { "message": "...", "details": [] } }
```

### Figures

Six figures are **measured** and stored, one row per entity per day: spend, impressions,
reach, clicks, conversions and revenue. Six ratios are **derived** on read and never
stored: CTR, CPC, CPM, CPA, ROAS and frequency.

A stored ratio would be a second source of truth for something already recorded, and the
two drift the moment a figure is corrected. It also cannot be re-summed: a week's CTR is
the week's clicks over the week's impressions, not the average of seven daily CTRs. A
ratio whose divisor is zero is reported as `null` — a campaign that spent money and got
no clicks has no cost per click, and `0` would read as free.

Ad platforms restate a day as attribution settles, so the key is `(entity, date)` and a
repeat replaces rather than appends. Each level stores what the platform reports *for that
level*: a campaign is never summed from its ads, because reach is deduplicated across the
campaign's audience. A project and the organization **are** summed from campaigns —
those are our own groupings and the platform has no opinion about them.

Nothing writes these figures yet. This change defines the shape they land in and reads
what is there; a later change connects the platforms.

Validation failures return 400 (including a range that ends before it starts), anything
the caller cannot reach returns 404, and anything unexpected returns 500.

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

A user is an identity — a name, an email, and optionally a phone and a Telegram handle
they keep current themselves in profile settings. What they may do comes from their
**membership** in the organization, which carries exactly one role — `ADMIN`, `MANAGER`, `GUEST` or `CLIENT`.
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
- `CLIENT` has read-only access to the client named by their grant, and may raise a task.
- `CLIENT_ADMIN` is the principal on a customer's own company: it reaches exactly what a
  `CLIENT` reaches, and additionally administers that company's people — invites them,
  sees the invitations outstanding, revokes one, removes somebody who joined. It writes
  nothing the agency owns.

Which side a role is on is asked through `isCustomer` rather than compared by name, so a
customer role added later is treated as one everywhere at once — in what it sees on the
board, in what a task it raises is marked with, and in its exclusion from the agency's
own staff listing.

All four roles may read audit history, but the same grants constrain which events they see.

### Registration

Registration is by invitation, and by nothing else: the invitation link is the only way
in, and no screen asks anybody to type a code. The invitation carries its own type, and
`GET /api/regustration/:code` answers it publicly — so `/regustration/:code` shows the
form the code calls for, and nothing else about the agency. An unknown, revoked, used or
expired code gives one answer for all four.

An **employee** gives a name, an email, a password and its confirmation, plus an avatar to
upload or generate. The invitation already decided their role and which projects it
grants.

Somebody **joining a company that already exists** fills the same fields and is asked
nothing about a company: the invitation named it. They become an ordinary `CLIENT` of that
client and reach its projects. Such an invitation is issued by either side — the client's
own principal, for their own company alone, or an agency admin for any client. A principal
naming somebody else's client is told it does not exist, so it cannot count the agency's
other customers.

A **client** fills two steps: their own account — the contact's fields, a password, an
avatar — and then the first project they create, with its monthly budget in `BYN`, `RUB`,
`USD` or `EUR`. A budget always carries the currency it is stated in; a project with no
amount still has one, so entering an amount later is a one-field decision. What a campaign
*spent* is a different figure and keeps its own formatting. The account, the client record, the
project and the grant over it are written in one transaction: either all of it lands or
none of it does and the link still works. Both steps stay mounted, so stepping back loses
nothing.

### What each role sees on the board

Reach decides which projects a member may look at. Whose work it is decides what they see
inside them, and can only narrow it further:

- `ADMIN` — every task in the organization.
- `MANAGER`, `GUEST` — only the tasks they are responsible for. A task nobody is
  responsible for is on the admin's board alone, which is the point: a client's request
  waits there until an admin reads it and hands it to somebody.
- `CLIENT` — only the tasks marked as shown to them.

A task raised by a client is marked shown to them when it is created; anything the agency
raises is its own. **Only an admin changes that mark** — a manager may create, edit and
complete a task, but what a customer is shown is one decision made in one place. The same
rule filters the WebSocket, so an event never delivers what a listing would not.

A customer's contact book is their own company's people — name, email, phone, Telegram
and who among them is the principal. The agency's client card is the company's contact
details alone. The employee directory is the agency's own staff, and a customer is not
offered it at all. Both lists show how to reach somebody, with a dash where a detail was
never given.

The web app has no screen for agency member administration. The contact book's employee pane
lists the organization's members with their name, email and role, read-only, and is where
invitations are issued; changing a role, suspending a member or removing one is done
through the member endpoints. The rules are unchanged and enforced server-side either
way — only an admin may make those changes, no admin may remove their own membership, and
the last admin cannot be removed.

### Seeding the first admin

Registration requires an invitation, and only an admin can issue one — so a brand-new
database has to be seeded once before anybody can get in at all:

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
