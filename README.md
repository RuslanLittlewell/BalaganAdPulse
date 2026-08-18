# AdPulse

A media buyer's dashboard. This repository hosts the backend REST API; the React
frontend will live alongside it in the same monorepo.

**Current phase:** Phase 9 — authentication and per-user data isolation. Every client
now belongs to a user, and every `/api` route requires a bearer token. CSV import and
AI analysis are deliberately out of scope for now.

## Upgrading an existing checkout

This release adds authentication, and it is **not** a drop-in upgrade for a checkout
that already has data:

- **Wipe the development database.** `Client` gains a non-null `owner_id` with no
  backfill, so the migration fails against a database that already holds clients —
  and the `api` container, which runs `prisma migrate deploy` on startup, then
  crash-loops. Run `docker compose down -v` (this drops the `adpulse_pgdata` volume),
  or `npx prisma migrate reset` inside `apps/api`.
- **Add the two new variables** to an existing `apps/api/.env` (and to the root `.env`
  if you run the stack from Compose): `JWT_SECRET` and `INVITE_CODE`. The API refuses
  to start without them, by design — see [Authentication](#authentication).
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
```

This runs the whole stack — Postgres, the API on `http://localhost:3000`, and the web
app on `http://localhost:5173`. The `api` container runs `prisma migrate deploy` on
startup, so the stack comes up fully migrated with no manual steps. Postgres data lives
in the named volume `adpulse_pgdata` and survives container restarts.

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

## Project structure

```
AdPulse/
  package.json              # npm workspaces ["apps/*"]
  docker-compose.yml        # db (Postgres) + api
  docker/postgres/init.sql  # creates the adpulse_test database
  apps/
    api/                    # backend
      prisma/schema.prisma  # Client, Campaign, CampaignProperty, CampaignRecord, CampaignPropertyValue
      src/
        app.ts              # builds the Express app (no listen) — used by tests
        server.ts           # entry point
        errors.ts           # domain errors
        lib/prisma.ts       # PrismaClient singleton
        middleware/         # unified error handling
        clients/            # routes -> controller -> service -> schema
        campaigns/          # campaign CRUD + the default property set
        properties/         # per-campaign property (column) management
        records/            # records (days) and their property values
        formula/            # expression tree: schema, evaluator, table rendering
      test/                 # Vitest + Supertest
    web/                    # frontend (React) — not created yet
  docs/superpowers/         # specs and plans per phase
```

Request flow: HTTP → routes → controller (Zod validation) → service (Prisma) →
PostgreSQL. Errors propagate to the error-handling middleware.

## API

Base prefix `/api`. Requests and responses are JSON.

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

Two environment variables are required, and the API refuses to start without them:

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Signs and verifies access tokens (HS256) |
| `INVITE_CODE` | The code `POST /auth/register` demands; registration is invite-only |

In production, startup additionally rejects the `.env.example` placeholders and a
`JWT_SECRET` shorter than 32 characters.

**401 versus 404.** A missing, malformed or expired token gives **401** — the request
never reaches a service. A resource that exists but belongs to another user gives
**404**, never 403: every lookup filters by owner, so someone else's id is
indistinguishable from an id that does not exist, and ids cannot be probed.

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
- [docs/superpowers/conventions.md](docs/superpowers/conventions.md) — shared context for specs and plans
- [docs/superpowers/specs/](docs/superpowers/specs/) — design documents per phase
- [docs/superpowers/plans/](docs/superpowers/plans/) — implementation plans per phase
