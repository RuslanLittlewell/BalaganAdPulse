# AdPulse Backend — Clients (Phase 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** REST API on TypeScript/Express/Prisma for media-buyer client CRUD in a monorepo, running in Docker with data persisted in a volume.

**Architecture:** Monorepo on npm workspaces (`apps/api`, placeholder for `apps/web`). Layered backend (routes → controller → service → Prisma). The Express app is assembled in `app.ts` without `listen` for testability. Docker Compose brings up PostgreSQL (data in a named volume) and the API. Host commands (Prisma, tests) use `localhost:5432`; the API container uses `db:5432`.

**Tech Stack:** TypeScript, Express, Prisma + PostgreSQL, Zod, Vitest, Supertest, tsx, Docker Compose, npm workspaces.

## Global Constraints

Shared conventions (API prefix, error envelope, Decimal, testing setup, Docker
environment split) live in [conventions.md](../conventions.md). This phase predates the
project's git workflow, plus its own specifics:

- **Git is NOT used** (per the user's request). Instead of a "commit" step, run a **checkpoint**: `npm test -w apps/api`, all green.
- **Monorepo:** root `package.json` with `workspaces: ["apps/*"]`. Backend in `apps/api`. `apps/web` is NOT created this phase, but the structure is in place.
- The only required client field is `name`; `niche`, `monthlyBudget`, `email` are optional. `email` is validated when present; `monthlyBudget` >= 0.
- Docker must be installed (Docker Desktop / Docker Engine + Compose v2).

---

### Task 1: Monorepo scaffold and test run

**Files:**
- Create: `package.json` (root)
- Create: `.gitignore`
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/vitest.config.ts`
- Create: `apps/api/src/health.ts`
- Test: `apps/api/test/health.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `add(a: number, b: number): number` from `apps/api/src/health.ts` (temporary, removed in Task 6) — proves the test pipeline works.

- [ ] **Step 1: Root package.json (workspaces)**

`package.json`:

```json
{
  "name": "adpulse",
  "version": "0.1.0",
  "private": true,
  "workspaces": ["apps/*"],
  "scripts": {
    "dev": "npm run dev -w apps/api",
    "test": "npm test -w apps/api",
    "build": "npm run build -w apps/api"
  }
}
```

- [ ] **Step 2: .gitignore**

`.gitignore`:

```
node_modules
dist
.env
.env.test
apps/*/node_modules
apps/*/dist
```

- [ ] **Step 3: Backend package.json and dependencies**

`apps/api/package.json`:

```json
{
  "name": "@adpulse/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "prisma:migrate": "prisma migrate dev",
    "prisma:generate": "prisma generate"
  }
}
```

Install dependencies (from the root, in the `@adpulse/api` workspace):

```bash
npm install -w @adpulse/api express @prisma/client zod dotenv
npm install -w @adpulse/api -D typescript tsx @types/node @types/express \
  vitest supertest @types/supertest prisma
```

- [ ] **Step 4: apps/api/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 5: apps/api/vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./test/setup.ts"],
  },
});
```

- [ ] **Step 6: apps/api/test/setup.ts**

Loads test-environment variables before Prisma is imported:

```ts
import { config } from "dotenv";

config({ path: ".env.test" });
```

- [ ] **Step 7: Write the failing test**

`apps/api/test/health.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { add } from "../src/health.js";

describe("add", () => {
  it("adds two numbers", () => {
    expect(add(2, 3)).toBe(5);
  });
});
```

- [ ] **Step 8: Run the test — it must fail**

Run: `npm test -w apps/api`
Expected: FAIL — module `../src/health.js` not found.

- [ ] **Step 9: Minimal implementation**

`apps/api/src/health.ts`:

```ts
export function add(a: number, b: number): number {
  return a + b;
}
```

- [ ] **Step 10: Run the test — it must pass**

Run: `npm test -w apps/api`
Expected: PASS.

- [ ] **Step 11: Checkpoint**

Run: `npm test -w apps/api`
Expected: all tests green. Stage complete.

---

### Task 2: Docker Compose, Postgres with a volume, environment

**Files:**
- Create: `docker-compose.yml`
- Create: `docker/postgres/init.sql`
- Create: `apps/api/Dockerfile`
- Create: `.dockerignore`
- Create: `.env` and `.env.example` (root)
- Create: `apps/api/.env` and `apps/api/.env.example`
- Create: `apps/api/.env.test`

**Interfaces:**
- Consumes: nothing.
- Produces: a running `db` service (Postgres) with the `adpulse` and `adpulse_test` databases, data in the `adpulse_pgdata` volume. The `api` service is defined but built/run in Task 7.

- [ ] **Step 1: Environment variables**

`.env.example` (root — for compose):

```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=adpulse
```

`apps/api/.env.example` (host commands: dev/prisma):

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/adpulse?schema=public"
PORT=3000
```

Create working copies:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
printf 'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/adpulse_test?schema=public"\n' > apps/api/.env.test
```

- [ ] **Step 2: init.sql — test database**

`docker/postgres/init.sql` (run by Postgres only on the first initialization of an empty volume):

```sql
CREATE DATABASE adpulse_test;
```

- [ ] **Step 3: .dockerignore**

`.dockerignore`:

```
node_modules
apps/*/node_modules
dist
apps/*/dist
.env
.env.test
.git
docs
```

- [ ] **Step 4: Backend Dockerfile (dev)**

`apps/api/Dockerfile`:

```dockerfile
FROM node:20-alpine
WORKDIR /app

# Monorepo manifests for dependency install
COPY package.json ./
COPY apps/api/package.json apps/api/
RUN npm install

# Sources (overridden by the compose bind-mount in dev)
COPY . .
RUN npx prisma generate --schema apps/api/prisma/schema.prisma

WORKDIR /app/apps/api
CMD ["sh", "-c", "npx prisma migrate deploy && npm run dev"]
```

- [ ] **Step 5: docker-compose.yml**

`docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "5432:5432"
    volumes:
      - adpulse_pgdata:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}?schema=public"
      PORT: 3000
    ports:
      - "3000:3000"
    volumes:
      - ./apps/api:/app/apps/api
      - /app/node_modules
      - /app/apps/api/node_modules

volumes:
  adpulse_pgdata:
```

- [ ] **Step 6: Bring up Postgres**

Run: `docker compose up -d db`
Expected: the `db` container reaches healthy (`docker compose ps`).

- [ ] **Step 7: Verify both databases**

Run:
```bash
docker compose exec db psql -U postgres -c "\l" | grep adpulse
```
Expected: both `adpulse` and `adpulse_test` are present.

> If `adpulse_test` is missing (volume created earlier without init.sql), create it manually:
> `docker compose exec db psql -U postgres -c "CREATE DATABASE adpulse_test;"`

- [ ] **Step 8: Checkpoint**

Run: `npm test -w apps/api`
Expected: all tests green (the Task 1 test still passes).

---

### Task 3: Prisma schema for Client and the DB client

**Files:**
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/lib/prisma.ts`

**Interfaces:**
- Consumes: the running Postgres from Task 2; `DATABASE_URL` from `apps/api/.env`.
- Produces: `prisma` (a `PrismaClient` instance) — exported from `apps/api/src/lib/prisma.ts`. The `Client` model: `id: string`, `name: string`, `niche: string | null`, `monthlyBudget: Prisma.Decimal | null`, `email: string | null`, `createdAt: Date`, `updatedAt: Date`.

- [ ] **Step 1: schema.prisma**

`apps/api/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

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

- [ ] **Step 2: Apply the migration to the dev database (host → localhost)**

Run: `npm run prisma:migrate -w apps/api -- --name init_client`
Expected: a migration is created under `apps/api/prisma/migrations`, the `Client` table exists in the `adpulse` database, the Prisma client is generated.

- [ ] **Step 3: Apply the schema to the test database**

Run: `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/adpulse_test?schema=public" npx prisma migrate deploy --schema apps/api/prisma/schema.prisma`
Expected: migrations applied to `adpulse_test`, the `Client` table created.

- [ ] **Step 4: PrismaClient singleton**

`apps/api/src/lib/prisma.ts`:

```ts
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
export default prisma;
```

- [ ] **Step 5: Build check**

Run: `npm run build -w apps/api`
Expected: compiles without errors.

- [ ] **Step 6: Checkpoint**

Run: `npm test -w apps/api`
Expected: all tests green.

---

### Task 4: Zod validation schemas

**Files:**
- Create: `apps/api/src/clients/client.schema.ts`
- Test: `apps/api/test/clients/client.schema.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `createClientSchema` — Zod schema: `name: string` (min 1), `niche?: string`, `monthlyBudget?: number` (>= 0), `email?: string` (email format).
  - `updateClientSchema` — the same fields, all optional (`.partial()`).
  - Types: `CreateClientInput = z.infer<typeof createClientSchema>`, `UpdateClientInput = z.infer<typeof updateClientSchema>`.

- [ ] **Step 1: Write the failing tests**

`apps/api/test/clients/client.schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createClientSchema, updateClientSchema } from "../../src/clients/client.schema.js";

describe("createClientSchema", () => {
  it("accepts name only", () => {
    expect(createClientSchema.safeParse({ name: "Acme" }).success).toBe(true);
  });
  it("rejects an empty name", () => {
    expect(createClientSchema.safeParse({ name: "" }).success).toBe(false);
  });
  it("rejects a negative budget", () => {
    expect(createClientSchema.safeParse({ name: "Acme", monthlyBudget: -1 }).success).toBe(false);
  });
  it("rejects an invalid email", () => {
    expect(createClientSchema.safeParse({ name: "Acme", email: "not-email" }).success).toBe(false);
  });
  it("accepts all valid fields", () => {
    const r = createClientSchema.safeParse({
      name: "Acme", niche: "fitness", monthlyBudget: 500, email: "a@b.com",
    });
    expect(r.success).toBe(true);
  });
});

describe("updateClientSchema", () => {
  it("accepts an empty object", () => {
    expect(updateClientSchema.safeParse({}).success).toBe(true);
  });
  it("rejects an empty name when present", () => {
    expect(updateClientSchema.safeParse({ name: "" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run — it must fail**

Run: `npm test -w apps/api -- client.schema`
Expected: FAIL — schema module not found.

- [ ] **Step 3: Implement the schemas**

`apps/api/src/clients/client.schema.ts`:

```ts
import { z } from "zod";

export const createClientSchema = z.object({
  name: z.string().min(1, "name is required"),
  niche: z.string().optional(),
  monthlyBudget: z.number().min(0, "monthlyBudget must be >= 0").optional(),
  email: z.email("invalid email").optional(),
});

export const updateClientSchema = createClientSchema.partial();

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
```

- [ ] **Step 4: Run — it must pass**

Run: `npm test -w apps/api -- client.schema`
Expected: PASS.

- [ ] **Step 5: Checkpoint**

Run: `npm test -w apps/api`
Expected: all tests green.

---

### Task 5: Client service (CRUD) + NotFoundError

**Files:**
- Create: `apps/api/src/errors.ts`
- Create: `apps/api/src/clients/client.service.ts`
- Create: `apps/api/test/helpers/db.ts`
- Test: `apps/api/test/clients/client.service.test.ts`

**Interfaces:**
- Consumes: `prisma` from `src/lib/prisma.ts`; the `CreateClientInput`, `UpdateClientInput` types from `client.schema.ts`.
- Produces:
  - `class NotFoundError extends Error` from `src/errors.ts` (field `status = 404`).
  - From `client.service.ts`:
    - `createClient(input: CreateClientInput): Promise<Client>`
    - `listClients(): Promise<Client[]>`
    - `getClient(id: string): Promise<Client>` — throws `NotFoundError` when absent.
    - `updateClient(id: string, input: UpdateClientInput): Promise<Client>` — throws `NotFoundError` when absent.
    - `deleteClient(id: string): Promise<void>` — throws `NotFoundError` when absent.
  - `resetDb(): Promise<void>` from `test/helpers/db.ts` — clears the `Client` table.

- [ ] **Step 1: Test helper and failing tests**

`apps/api/test/helpers/db.ts`:

```ts
import { prisma } from "../../src/lib/prisma.js";

export async function resetDb(): Promise<void> {
  await prisma.client.deleteMany();
}
```

`apps/api/test/clients/client.service.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { resetDb } from "../helpers/db.js";
import { prisma } from "../../src/lib/prisma.js";
import {
  createClient, listClients, getClient, updateClient, deleteClient,
} from "../../src/clients/client.service.js";
import { NotFoundError } from "../../src/errors.js";

const MISSING = "00000000-0000-0000-0000-000000000000";

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("client.service", () => {
  it("creates a client with name only", async () => {
    const c = await createClient({ name: "Acme" });
    expect(c.id).toBeTruthy();
    expect(c.name).toBe("Acme");
    expect(c.niche).toBeNull();
  });
  it("returns the list", async () => {
    await createClient({ name: "A" });
    await createClient({ name: "B" });
    expect((await listClients()).length).toBe(2);
  });
  it("getClient throws NotFoundError", async () => {
    await expect(getClient(MISSING)).rejects.toBeInstanceOf(NotFoundError);
  });
  it("updates a client", async () => {
    const c = await createClient({ name: "A" });
    const u = await updateClient(c.id, { niche: "fitness" });
    expect(u.niche).toBe("fitness");
  });
  it("updateClient throws NotFoundError", async () => {
    await expect(updateClient(MISSING, { name: "X" })).rejects.toBeInstanceOf(NotFoundError);
  });
  it("deletes a client", async () => {
    const c = await createClient({ name: "A" });
    await deleteClient(c.id);
    expect((await listClients()).length).toBe(0);
  });
  it("deleteClient throws NotFoundError", async () => {
    await expect(deleteClient(MISSING)).rejects.toBeInstanceOf(NotFoundError);
  });
});
```

- [ ] **Step 2: Run — it must fail**

Run: `npm test -w apps/api -- client.service`
Expected: FAIL — `errors`/`client.service` modules not found.

- [ ] **Step 3: Implement the error**

`apps/api/src/errors.ts`:

```ts
export class NotFoundError extends Error {
  status = 404;
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}
```

- [ ] **Step 4: Implement the service**

`apps/api/src/clients/client.service.ts`:

```ts
import type { Client } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { NotFoundError } from "../errors.js";
import type { CreateClientInput, UpdateClientInput } from "./client.schema.js";

export async function createClient(input: CreateClientInput): Promise<Client> {
  return prisma.client.create({ data: input });
}

export async function listClients(): Promise<Client[]> {
  return prisma.client.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getClient(id: string): Promise<Client> {
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) throw new NotFoundError("Client not found");
  return client;
}

export async function updateClient(id: string, input: UpdateClientInput): Promise<Client> {
  await getClient(id);
  return prisma.client.update({ where: { id }, data: input });
}

export async function deleteClient(id: string): Promise<void> {
  await getClient(id);
  await prisma.client.delete({ where: { id } });
}
```

- [ ] **Step 5: Run — it must pass**

Run: `npm test -w apps/api -- client.service`
Expected: PASS (Postgres from Task 2 is up, `adpulse_test` is migrated).

- [ ] **Step 6: Checkpoint**

Run: `npm test -w apps/api`
Expected: all tests green.

---

### Task 6: HTTP layer — app, controller, routes, error-handler (Supertest)

**Files:**
- Create: `apps/api/src/middleware/error-handler.ts`
- Create: `apps/api/src/clients/client.controller.ts`
- Create: `apps/api/src/clients/client.routes.ts`
- Create: `apps/api/src/app.ts`
- Delete: `apps/api/src/health.ts`, `apps/api/test/health.test.ts` (temporary from Task 1)
- Test: `apps/api/test/clients/client.api.test.ts`

**Interfaces:**
- Consumes: service functions from `client.service.ts`; `createClientSchema`, `updateClientSchema`; `NotFoundError`; `resetDb`.
- Produces:
  - `createApp(): express.Express` from `src/app.ts` — mounts routes at `/api/clients` and the error-handler last.
  - `clientRouter` from `client.routes.ts`.
  - `errorHandler` (Express error middleware) from `error-handler.ts` — 400 for `ZodError`, `err.status` when present, otherwise 500; shape `{ error: { message, details? } }`.

- [ ] **Step 1: Write the failing API tests**

`apps/api/test/clients/client.api.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { resetDb } from "../helpers/db.js";
import { prisma } from "../../src/lib/prisma.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("Clients API", () => {
  it("POST /api/clients creates (201)", async () => {
    const res = await request(app).post("/api/clients").send({ name: "Acme" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Acme");
  });
  it("POST /api/clients with empty name -> 400", async () => {
    const res = await request(app).post("/api/clients").send({ name: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBeTruthy();
  });
  it("GET /api/clients returns the list (200)", async () => {
    await request(app).post("/api/clients").send({ name: "A" });
    const res = await request(app).get("/api/clients");
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });
  it("GET /api/clients/:id for a missing id -> 404", async () => {
    const res = await request(app).get(`/api/clients/${MISSING}`);
    expect(res.status).toBe(404);
  });
  it("PATCH /api/clients/:id updates (200)", async () => {
    const c = await request(app).post("/api/clients").send({ name: "A" });
    const res = await request(app).patch(`/api/clients/${c.body.id}`).send({ niche: "fitness" });
    expect(res.status).toBe(200);
    expect(res.body.niche).toBe("fitness");
  });
  it("DELETE /api/clients/:id deletes (204)", async () => {
    const c = await request(app).post("/api/clients").send({ name: "A" });
    const res = await request(app).delete(`/api/clients/${c.body.id}`);
    expect(res.status).toBe(204);
  });
});
```

- [ ] **Step 2: Run — it must fail**

Run: `npm test -w apps/api -- client.api`
Expected: FAIL — `../../src/app.js` not found.

- [ ] **Step 3: Error-handler middleware**

`apps/api/src/middleware/error-handler.ts`:

```ts
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: { message: "Validation error", details: err.issues } });
    return;
  }
  const status = typeof (err as { status?: number }).status === "number"
    ? (err as { status: number }).status
    : 500;
  const message = err instanceof Error ? err.message : "Internal error";
  res.status(status).json({ error: { message } });
}
```

- [ ] **Step 4: Controller**

`apps/api/src/clients/client.controller.ts`:

```ts
import type { NextFunction, Request, Response } from "express";
import { createClientSchema, updateClientSchema } from "./client.schema.js";
import {
  createClient, listClients, getClient, updateClient, deleteClient,
} from "./client.service.js";

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createClientSchema.parse(req.body);
    res.status(201).json(await createClient(data));
  } catch (e) { next(e); }
}

export async function list(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await listClients());
  } catch (e) { next(e); }
}

export async function getOne(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    res.json(await getClient(req.params.id));
  } catch (e) { next(e); }
}

export async function update(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const data = updateClientSchema.parse(req.body);
    res.json(await updateClient(req.params.id, data));
  } catch (e) { next(e); }
}

export async function remove(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    await deleteClient(req.params.id);
    res.status(204).send();
  } catch (e) { next(e); }
}
```

- [ ] **Step 5: Routes**

`apps/api/src/clients/client.routes.ts`:

```ts
import { Router } from "express";
import * as controller from "./client.controller.js";

export const clientRouter = Router();

clientRouter.post("/", controller.create);
clientRouter.get("/", controller.list);
clientRouter.get("/:id", controller.getOne);
clientRouter.patch("/:id", controller.update);
clientRouter.delete("/:id", controller.remove);
```

- [ ] **Step 6: app.ts**

`apps/api/src/app.ts`:

```ts
import express from "express";
import { clientRouter } from "./clients/client.routes.js";
import { errorHandler } from "./middleware/error-handler.js";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/clients", clientRouter);
  app.use(errorHandler);
  return app;
}

export default createApp;
```

- [ ] **Step 7: Delete the temporary Task 1 files**

```bash
rm apps/api/src/health.ts apps/api/test/health.test.ts
```

- [ ] **Step 8: Run all tests**

Run: `npm test -w apps/api`
Expected: PASS — service and API green, the temporary health test removed.

- [ ] **Step 9: Checkpoint**

Run: `npm test -w apps/api`
Expected: all tests green.

---

### Task 7: Server entry point and running in Docker with a persistence check

**Files:**
- Create: `apps/api/src/server.ts`

**Interfaces:**
- Consumes: `createApp` from `src/app.ts`; the `db`/`api` services from `docker-compose.yml`.
- Produces: a runnable server; the app runs in the container and Postgres data survives a restart.

- [ ] **Step 1: server.ts**

`apps/api/src/server.ts`:

```ts
import "dotenv/config";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

app.listen(port, () => {
  console.log(`AdPulse API listening on http://localhost:${port}`);
});
```

- [ ] **Step 2: Build and run the whole stack in Docker**

Run: `docker compose up -d --build`
Expected: the `db` (healthy) and `api` (running) containers. Logs: `docker compose logs api` contain `AdPulse API listening`.

> The Dockerfile CMD applies migrations (`prisma migrate deploy`) before starting, so a fresh volume is provisioned automatically with no manual step.

- [ ] **Step 3: Create a client via the API in the container**

Run:
```bash
curl -s -X POST http://localhost:3000/api/clients \
  -H 'Content-Type: application/json' -d '{"name":"Persist Co"}'
```
Expected: JSON of the created client with an `id`, status 201.

- [ ] **Step 4: Verify persistence after a restart**

Run:
```bash
docker compose restart
sleep 3
curl -s http://localhost:3000/api/clients
```
Expected: `Persist Co` is present in the list — data survived in the `adpulse_pgdata` volume.

- [ ] **Step 5: Backend build check**

Run: `npm run build -w apps/api`
Expected: compiles without errors.

- [ ] **Step 6: Final checkpoint**

Run: `npm test -w apps/api`
Expected: all tests green. Phase 1 complete.

---

## Plan vs. spec check

- **Monorepo (apps/api, apps/web placeholder, workspaces)** — Task 1. OK
- **Docker: Postgres + API, data in a volume, persistence** — Task 2 (compose/volume) + Task 7 (run + restart check). OK
- **Separate adpulse_test database** — Task 2 (init.sql) + Task 3 (migration). OK
- **Client CRUD** — Tasks 4–6 (validation, service, HTTP). OK
- **Client model (name required; niche/monthlyBudget/email optional; Decimal)** — Task 3 + Task 4. OK
- **Endpoints POST/GET/GET:id/PATCH/DELETE under `/api`** — Task 6. OK
- **Unified error shape, codes 400/404/500** — Task 6 + Task 5 (NotFoundError). OK
- **Layered architecture (app without listen, for tests)** — Tasks 6–7. OK
- **TDD (test before implementation)** — in every task. OK
- **No git, checkpoints instead of commits** — Global Constraints and steps. OK
- **Phase 2 groundwork (metrics/campaigns)** — not implemented, the schema does not block adding it. OK
