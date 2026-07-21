# AdPulse

A media buyer's dashboard. This repository hosts the backend REST API; the React
frontend will live alongside it in the same monorepo.

**Current phase:** Phase 1 — client CRUD. Authentication, multi-tenancy, campaign
metrics, CSV import and AI analysis are deliberately out of scope for now.

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
      prisma/schema.prisma  # Client model
      src/
        app.ts              # builds the Express app (no listen) — used by tests
        server.ts           # entry point
        errors.ts           # domain errors
        lib/prisma.ts       # PrismaClient singleton
        middleware/         # unified error handling
        clients/            # routes -> controller -> service -> schema
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

`name` is required on create; `niche`, `monthlyBudget` and `email` are optional.
Errors are normalized to a single shape:

```json
{ "error": { "message": "...", "details": [] } }
```

Validation failures return 400, a missing client returns 404, anything unexpected
returns 500.

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
