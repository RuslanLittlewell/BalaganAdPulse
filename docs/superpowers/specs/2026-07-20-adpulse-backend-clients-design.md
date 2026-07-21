# AdPulse Backend — Design (Phase 1: clients)

**Date:** 2026-07-20
**Status:** approved for implementation

## Context

AdPulse is a media buyer's dashboard. The backend exposes a REST API; the UI is
a separate React application.

Full product vision (future, NOT in current scope):
- SaaS with per-media-buyer data isolation, authentication
- client management
- automatic metric calculation (CTR, CPM, CPC, CPL)
- CSV import
- AI campaign analysis (Claude)
- shareable public-link reports

The current phase is deliberately minimal (YAGNI): start with client CRUD, then the
metrics table (details later).

## Phase 1 scope

**In scope:** client CRUD (create / list / read / update / delete).

**Out of scope for now:** authentication, multi-tenancy, AI, CSV, metrics, campaigns.
The database schema is designed so that `Client → Campaign → Metric` can be added in
Phase 2 without reworking the existing code.

## Stack

- **Language:** TypeScript
- **Web framework:** Express
- **Database:** PostgreSQL
- **ORM:** Prisma (migrations + type-safe access)
- **Validation:** Zod
- **Tests:** Vitest + Supertest (TDD)
- **Repository:** monorepo on npm workspaces (`apps/api`, placeholder for `apps/web`)
- **Infrastructure:** Docker Compose (PostgreSQL + API); DB data in a named volume

## Repository layout (monorepo)

The API and the future frontend live in one repository, with the split established up
front. The root manages the workspaces; each app is a self-contained package.

```
AdPulse/
  package.json              # root: npm workspaces ["apps/*"]
  docker-compose.yml        # services: db (Postgres) + api; volume for DB data
  .env / .env.example       # variables for docker/host commands
  docker/
    postgres/init.sql       # creates the adpulse_test test database
  apps/
    api/                    # backend (this phase)
      package.json
      tsconfig.json
      vitest.config.ts
      Dockerfile            # API image (dev)
      prisma/schema.prisma  # Client model
      src/
        app.ts              # builds the Express app (no listen) — for tests
        server.ts           # entry point: app.listen
        errors.ts           # domain errors (NotFoundError)
        lib/prisma.ts       # PrismaClient singleton
        middleware/error-handler.ts  # unified error handling
        clients/
          client.routes.ts      # /clients routes
          client.controller.ts  # request parsing -> service -> response shaping
          client.service.ts     # business logic + Prisma access
          client.schema.ts      # Zod schemas (create/update)
      test/                 # Vitest + Supertest
    web/                    # FRONTEND (React) — placeholder, not created this phase
```

**Data flow:** HTTP → routes → controller (Zod validation) → service (Prisma) →
PostgreSQL, back to JSON. Errors propagate to the error-handler middleware.

## Docker and data persistence

- **db** — the `postgres` image, data in a **named volume** (`adpulse_pgdata`) so it
  survives system/container restarts. Port 5432 is published to the host for local
  commands (Prisma, tests).
- **api** — built from `apps/api/Dockerfile`, dev mode with hot reload (`tsx watch`),
  sources mounted via bind mount. `DATABASE_URL` inside the container points at host `db`.
- **Test database:** a separate `adpulse_test` database in the same Postgres instance
  (created by `docker/postgres/init.sql`) so clearing data in tests does not touch dev data.
- **Environment separation:** host commands (`prisma migrate`, `npm test`) use
  `localhost:5432`; the `api` container uses `db:5432`.
- **Auto-provisioning:** the `api` container applies migrations to `adpulse` on startup
  (`prisma migrate deploy` in the CMD) — `docker compose up --build` yields a working
  stack with no manual steps. On the host, `npm test` applies migrations to
  `adpulse_test` via a `pretest` script, so tests restore the schema by themselves after
  a volume is recreated.

## Data model

### Client

| field | type | required | validation |
|-------|------|:---:|-----------|
| id | uuid | — | generated |
| name | string | yes | non-empty string |
| niche | string \| null | no | — |
| monthlyBudget | Decimal \| null | no | number >= 0 |
| email | string \| null | no | email format (when provided) |
| createdAt | datetime | — | auto |
| updatedAt | datetime | — | auto |

`Decimal` for money (not float) to avoid precision loss.

Prisma sketch:

```prisma
model Client {
  id            String   @id @default(uuid())
  name          String
  niche         String?
  monthlyBudget Decimal? @db.Decimal(12, 2)
  email         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

## API

Base prefix: `/api`. Request bodies and responses are JSON.

| Method | Path | Description | Success |
|--------|------|-------------|:---:|
| POST | `/clients` | Create a client | 201 |
| GET | `/clients` | List clients | 200 |
| GET | `/clients/:id` | Single client | 200 |
| PATCH | `/clients/:id` | Partial update | 200 |
| DELETE | `/clients/:id` | Delete | 204 |

**Create (body):** `name` is required; `niche`, `monthlyBudget`, `email` are optional.
**Update (body):** any subset of fields; the same validation rules apply.

## Error handling

A central middleware normalizes everything to a single JSON shape:

```json
{ "error": { "message": "...", "details": [ ... ] } }
```

| Situation | Code |
|-----------|:---:|
| Validation error (Zod) | 400 |
| Client not found | 404 |
| Internal error | 500 |

## Testing (TDD)

- **Service:** unit tests for business logic (create, update, missing client).
- **API:** integration tests via Supertest against `app` (all endpoints + error codes).
- **Validation:** tests that reject invalid input (empty `name`, negative budget,
  invalid email).

Tests are written before the implementation for each slice.

## Phase 2 groundwork (not implemented now)

- `Campaign` (belongs to `Client`) and `Metric` (belongs to `Campaign`).
- CSV import → metric rows; automatic CTR / CPM / CPC / CPL calculation.
- The metrics table structure will be provided by the user later.
