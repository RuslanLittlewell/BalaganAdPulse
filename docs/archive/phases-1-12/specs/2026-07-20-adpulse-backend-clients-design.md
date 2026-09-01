# AdPulse Backend — Design (Phase 1: clients)

**Date:** 2026-07-20
**Status:** approved for implementation

> Shared context and conventions: [conventions.md](../conventions.md).

## Context

Phase 1 is the first slice of AdPulse (see [conventions.md](../conventions.md) for the
product and its wider vision). It is deliberately minimal (YAGNI): client CRUD first,
the metrics table later.

## Phase 1 scope

**In scope:** client CRUD (create / list / read / update / delete).

**Out of scope for now:** authentication, multi-tenancy, AI, CSV, metrics, campaigns.
The database schema is designed so that `Client → Campaign → Metric` can be added in
Phase 2 without reworking the existing code.

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

Standard project setup (see [conventions.md](../conventions.md) for volume, test
database and host-vs-container environment split). The `api` container applies
migrations on startup (`prisma migrate deploy` in the CMD), so `docker compose up
--build` yields a working, migrated stack with no manual steps; on the host, `pretest`
migrates `adpulse_test` so tests restore the schema by themselves after a volume is
recreated.

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

## Phase 2 groundwork (not implemented now)

- `Campaign` (belongs to `Client`) and `Metric` (belongs to `Campaign`).
- CSV import → metric rows; automatic CTR / CPM / CPC / CPL calculation.
- The metrics table structure will be provided by the user later.
