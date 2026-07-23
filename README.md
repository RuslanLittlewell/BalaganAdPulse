# AdPulse

A media buyer's dashboard. This repository hosts the backend REST API; the React
frontend will live alongside it in the same monorepo.

**Current phase:** Phase 2 — campaigns and the daily stats table. Authentication,
multi-tenancy, CSV import and AI analysis are deliberately out of scope for now.

## Stack

TypeScript · Express 5 · PostgreSQL 16 · Prisma · Zod · Vitest + Supertest ·
Docker Compose · npm workspaces

## Quick start

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
docker compose up --build
```

The API is available at `http://localhost:3000`. The `api` container runs
`prisma migrate deploy` on startup, so the stack comes up fully migrated with no
manual steps. Postgres data lives in the named volume `adpulse_pgdata` and survives
container restarts.

To run the API on the host instead (Postgres still from Compose):

```bash
docker compose up -d db
npm install
npm run dev
```

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
CPC, leads, CPL, revenue, ROAS, comment). Derived properties carry a formula — an
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
- [docs/superpowers/specs/](docs/superpowers/specs/) — design documents per phase
- [docs/superpowers/plans/](docs/superpowers/plans/) — implementation plans per phase
