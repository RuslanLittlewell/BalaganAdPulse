# Campaigns and the Daily Stats Table — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the backend for a client's campaigns, each holding one editable table of daily statistics with per-campaign columns, entered cells and computed metrics.

**Architecture:** A `Campaign` owns its own `CampaignColumn` set (seeded with 11 defaults), `CampaignRow` per day, and `CampaignCell` records that store only hand-entered values. Derived metrics (CTR, CPM, CPC, CPL, ROAS) are columns carrying a formula — an expression tree stored as JSONB — and are evaluated on read, never stored. Pure formula code lives in `src/formula/` with no Prisma or HTTP dependency; the existing routes → controller (Zod) → service (Prisma) layering from Phase 1 is preserved.

**Tech Stack:** TypeScript, Express 5, Prisma 6 / PostgreSQL, Zod 4, Vitest 4 + Supertest.

**Spec:** [docs/superpowers/specs/2026-07-21-adpulse-campaigns-design.md](../specs/2026-07-21-adpulse-campaigns-design.md)

## Global Constraints

Shared conventions (English-only, Conventional Commits, TDD, testing setup, error
envelope, Decimal-as-strings) live in [conventions.md](../conventions.md).
Phase-specific:

- Run a single test file with `npm test -w apps/api -- <path>`; run everything with `npm test`.
- Do not touch `src/clients/*` — Phase 1 code stays as it is. The only pre-existing files this plan modifies are `prisma/schema.prisma`, `src/errors.ts`, `src/app.ts`, `test/helpers/db.ts`, `README.md`, and the test harness (`vitest.config.ts`, `test/setup.ts`, `package.json`) — the cascading foreign keys added in Task 1 require per-worker database isolation, decided during execution.

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `src/formula/expression.schema.ts` | `Expression` type + recursive Zod schema + JSON conversion helpers |
| `src/formula/evaluate.ts` | evaluates an expression tree over a value resolver |
| `src/formula/dependencies.ts` | column references, cycle detection, formula validation |
| `src/formula/table.ts` | renders columns + rows into `values` maps and the totals row |
| `src/campaigns/defaults.ts` | the 11 default columns with their formulas |
| `src/campaigns/campaign.{service,schema,controller,routes}.ts` | campaign CRUD and the full table payload |
| `src/columns/column.{service,schema,controller,routes}.ts` | column add / edit / delete / reorder |
| `src/rows/row.{service,schema,controller,routes}.ts` | day add / move / delete |
| `src/rows/cell.{service,schema,controller}.ts` | cell writes (lives with rows: cells are only ever addressed through a row) |

**Modified:** `prisma/schema.prisma`, `src/errors.ts`, `src/app.ts`, `test/helpers/db.ts`, `README.md`.

---

### Task 1: Database schema and domain errors

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/src/errors.ts`
- Modify: `apps/api/test/helpers/db.ts`
- Test: `apps/api/test/campaigns/schema.test.ts`, `apps/api/test/errors.test.ts`

**Interfaces:**
- Consumes: the existing `Client` model and `NotFoundError`.
- Produces: Prisma models `Campaign`, `CampaignColumn`, `CampaignRow`, `CampaignCell`, enum `ColumnType`; `ValidationError` (status 400) and `ConflictError` (status 409); `resetDb()` clearing all new tables.

- [ ] **Step 1: Write the failing tests**

`apps/api/test/errors.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ConflictError, NotFoundError, ValidationError } from "../src/errors.js";

describe("domain errors", () => {
  it("NotFoundError carries status 404", () => {
    expect(new NotFoundError("Campaign not found").status).toBe(404);
  });
  it("ValidationError carries status 400", () => {
    const error = new ValidationError("Formula creates a circular reference");
    expect(error.status).toBe(400);
    expect(error.message).toBe("Formula creates a circular reference");
  });
  it("ConflictError carries status 409", () => {
    expect(new ConflictError("Date already used").status).toBe(409);
  });
});
```

`apps/api/test/campaigns/schema.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { resetDb } from "../helpers/db.js";

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

async function seedCampaign() {
  const client = await prisma.client.create({ data: { name: "Acme" } });
  const campaign = await prisma.campaign.create({
    data: { clientId: client.id, name: "Facebook — July", position: 0 },
  });
  return { client, campaign };
}

describe("campaign schema", () => {
  it("stores a cell value as Decimal without precision loss", async () => {
    const { campaign } = await seedCampaign();
    const column = await prisma.campaignColumn.create({
      data: { campaignId: campaign.id, key: "spend", name: "SPEND", type: "MONEY", position: 0 },
    });
    const row = await prisma.campaignRow.create({
      data: { campaignId: campaign.id, date: new Date("2026-07-21T00:00:00.000Z") },
    });
    const cell = await prisma.campaignCell.create({
      data: { rowId: row.id, columnId: column.id, numberValue: "1234.5678" },
    });
    expect(String(cell.numberValue)).toBe("1234.5678");
  });

  it("stores a formula as JSON on a column", async () => {
    const { campaign } = await seedCampaign();
    const column = await prisma.campaignColumn.create({
      data: {
        campaignId: campaign.id, key: "ctr", name: "CTR", type: "PERCENT", position: 1,
        formula: { kind: "const", value: "100" },
      },
    });
    const stored = await prisma.campaignColumn.findUniqueOrThrow({ where: { id: column.id } });
    expect(stored.formula).toEqual({ kind: "const", value: "100" });
  });

  it("rejects two rows with the same date in one campaign", async () => {
    const { campaign } = await seedCampaign();
    const date = new Date("2026-07-21T00:00:00.000Z");
    await prisma.campaignRow.create({ data: { campaignId: campaign.id, date } });
    await expect(
      prisma.campaignRow.create({ data: { campaignId: campaign.id, date } }),
    ).rejects.toThrow();
  });

  it("cascades deletion from the client down to cells", async () => {
    const { client, campaign } = await seedCampaign();
    const column = await prisma.campaignColumn.create({
      data: { campaignId: campaign.id, key: "spend", name: "SPEND", type: "MONEY", position: 0 },
    });
    const row = await prisma.campaignRow.create({
      data: { campaignId: campaign.id, date: new Date("2026-07-21T00:00:00.000Z") },
    });
    await prisma.campaignCell.create({
      data: { rowId: row.id, columnId: column.id, numberValue: "10" },
    });

    await prisma.client.delete({ where: { id: client.id } });

    expect(await prisma.campaign.count()).toBe(0);
    expect(await prisma.campaignColumn.count()).toBe(0);
    expect(await prisma.campaignRow.count()).toBe(0);
    expect(await prisma.campaignCell.count()).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w apps/api -- test/errors.test.ts test/campaigns/schema.test.ts`
Expected: FAIL — `ValidationError` is not exported and `prisma.campaign` is undefined.

- [ ] **Step 3: Add the domain errors**

Append to `apps/api/src/errors.ts`:

```ts
export class ValidationError extends Error {
  status = 400;
  constructor(message = "Validation error") {
    super(message);
    this.name = "ValidationError";
  }
}

export class ConflictError extends Error {
  status = 409;
  constructor(message = "Conflict") {
    super(message);
    this.name = "ConflictError";
  }
}
```

- [ ] **Step 4: Extend the Prisma schema**

Add to `apps/api/prisma/schema.prisma` — a `campaigns` relation on `Client` plus the new models:

```prisma
model Client {
  id            String     @id @default(uuid())
  name          String
  niche         String?
  monthlyBudget Decimal?   @db.Decimal(12, 2)
  email         String?
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  campaigns     Campaign[]
}

model Campaign {
  id        String           @id @default(uuid())
  clientId  String
  client    Client           @relation(fields: [clientId], references: [id], onDelete: Cascade)
  name      String
  position  Int
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt
  columns   CampaignColumn[]
  rows      CampaignRow[]

  @@index([clientId, position])
}

enum ColumnType {
  NUMBER
  MONEY
  PERCENT
  TEXT
}

model CampaignColumn {
  id         String         @id @default(uuid())
  campaignId String
  campaign   Campaign       @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  name       String
  key        String?
  type       ColumnType
  formula    Json?
  position   Int
  cells      CampaignCell[]

  @@index([campaignId, position])
}

model CampaignRow {
  id         String         @id @default(uuid())
  campaignId String
  campaign   Campaign       @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  date       DateTime       @db.Date
  cells      CampaignCell[]

  @@unique([campaignId, date])
}

/// One value typed in by the user, at the intersection of a day and a column.
/// Exists only for columns without a formula — computed metrics are never stored here.
model CampaignCell {
  id          String         @id @default(uuid())
  rowId       String
  columnId    String
  row         CampaignRow    @relation(fields: [rowId], references: [id], onDelete: Cascade)
  column      CampaignColumn @relation(fields: [columnId], references: [id], onDelete: Cascade)
  numberValue Decimal?       @db.Decimal(18, 4)
  textValue   String?

  @@unique([rowId, columnId])
}
```

- [ ] **Step 5: Create the migration**

```bash
docker compose up -d db
npm run prisma:migrate -w apps/api -- --name add_campaigns
```

Expected: a new directory under `apps/api/prisma/migrations/` and "Your database is now in sync with your schema" plus a regenerated Prisma client.

- [ ] **Step 6: Clear the new tables in the test helper**

Replace the body of `apps/api/test/helpers/db.ts`:

```ts
import { prisma } from "../../src/lib/prisma.js";

export async function resetDb(): Promise<void> {
  await prisma.campaignCell.deleteMany();
  await prisma.campaignRow.deleteMany();
  await prisma.campaignColumn.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.client.deleteMany();
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test -w apps/api -- test/errors.test.ts test/campaigns/schema.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 8: Commit**

```bash
git add apps/api/prisma apps/api/src/errors.ts apps/api/test/helpers/db.ts apps/api/test/errors.test.ts apps/api/test/campaigns/schema.test.ts
git commit -m "feat(db): add campaign, column, row and cell models"
```

---

### Task 2: Expression schema and JSON conversion

**Files:**
- Create: `apps/api/src/formula/expression.schema.ts`
- Test: `apps/api/test/formula/expression.schema.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks except `Prisma` types.
- Produces:
  - `type BinaryOperator = "+" | "-" | "*" | "/"`
  - `type Expression = { kind: "binary"; op: BinaryOperator; left: Expression; right: Expression } | { kind: "column"; columnId: string } | { kind: "const"; value: string }`
  - `expressionSchema: z.ZodType<Expression>`
  - `toJson(formula: Expression | null): Prisma.InputJsonValue | typeof Prisma.DbNull`
  - `fromJson(value: Prisma.JsonValue | null): Expression | null`

- [ ] **Step 1: Write the failing test**

`apps/api/test/formula/expression.schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { expressionSchema, toJson, fromJson } from "../../src/formula/expression.schema.js";

const CLICKS = "11111111-1111-1111-1111-111111111111";
const IMPRESSIONS = "22222222-2222-2222-2222-222222222222";

const ctr = {
  kind: "binary", op: "*",
  left: {
    kind: "binary", op: "/",
    left: { kind: "column", columnId: CLICKS },
    right: { kind: "column", columnId: IMPRESSIONS },
  },
  right: { kind: "const", value: "100" },
};

describe("expressionSchema", () => {
  it("parses a nested tree", () => {
    expect(expressionSchema.parse(ctr)).toEqual(ctr);
  });
  it("rejects an unknown operator", () => {
    expect(() => expressionSchema.parse({
      kind: "binary", op: "%",
      left: { kind: "const", value: "1" }, right: { kind: "const", value: "2" },
    })).toThrow();
  });
  it("rejects an unknown node kind", () => {
    expect(() => expressionSchema.parse({ kind: "lookup", columnId: CLICKS })).toThrow();
  });
  it("rejects a non-decimal constant", () => {
    expect(() => expressionSchema.parse({ kind: "const", value: "ten" })).toThrow();
  });
  it("rejects a column reference that is not a uuid", () => {
    expect(() => expressionSchema.parse({ kind: "column", columnId: "clicks" })).toThrow();
  });
  it("rejects a malformed nested branch", () => {
    expect(() => expressionSchema.parse({
      kind: "binary", op: "+",
      left: { kind: "const", value: "1" }, right: { kind: "const" },
    })).toThrow();
  });
});

describe("json conversion", () => {
  it("maps null to Prisma.DbNull and back", () => {
    expect(toJson(null)).toBe(Prisma.DbNull);
    expect(fromJson(null)).toBeNull();
  });
  it("round-trips a tree", () => {
    const stored = toJson(expressionSchema.parse(ctr)) as Prisma.JsonValue;
    expect(fromJson(stored)).toEqual(ctr);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w apps/api -- test/formula/expression.schema.test.ts`
Expected: FAIL — cannot resolve `src/formula/expression.schema.js`.

- [ ] **Step 3: Write the implementation**

`apps/api/src/formula/expression.schema.ts`:

```ts
import { Prisma } from "@prisma/client";
import { z } from "zod";

export type BinaryOperator = "+" | "-" | "*" | "/";

export type Expression =
  | { kind: "binary"; op: BinaryOperator; left: Expression; right: Expression }
  | { kind: "column"; columnId: string }
  | { kind: "const"; value: string };

export const expressionSchema: z.ZodType<Expression> = z.lazy(() =>
  z.union([
    z.object({
      kind: z.literal("binary"),
      op: z.enum(["+", "-", "*", "/"]),
      left: expressionSchema,
      right: expressionSchema,
    }),
    z.object({
      kind: z.literal("column"),
      columnId: z.uuid("columnId must be a uuid"),
    }),
    z.object({
      kind: z.literal("const"),
      value: z.string().regex(/^-?\d+(\.\d+)?$/, "const value must be a decimal string"),
    }),
  ]),
);

// Prisma types JSON columns structurally; an Expression is JSON-safe by construction,
// so the cast is the documented way to hand it over without widening the domain type.
export function toJson(formula: Expression | null): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return formula === null ? Prisma.DbNull : (formula as unknown as Prisma.InputJsonValue);
}

export function fromJson(value: Prisma.JsonValue | null): Expression | null {
  return value === null ? null : (value as unknown as Expression);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w apps/api -- test/formula/expression.schema.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/formula/expression.schema.ts apps/api/test/formula/expression.schema.test.ts
git commit -m "feat(formula): add expression tree schema"
```

---

### Task 3: Expression evaluator

**Files:**
- Create: `apps/api/src/formula/evaluate.ts`
- Test: `apps/api/test/formula/evaluate.test.ts`

**Interfaces:**
- Consumes: `Expression` from `src/formula/expression.schema.js`.
- Produces:
  - `type ValueResolver = (columnId: string) => Prisma.Decimal | null`
  - `evaluate(expression: Expression, resolve: ValueResolver): Prisma.Decimal | null`

- [ ] **Step 1: Write the failing test**

`apps/api/test/formula/evaluate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { evaluate } from "../../src/formula/evaluate.js";
import type { Expression } from "../../src/formula/expression.schema.js";

const CLICKS = "11111111-1111-1111-1111-111111111111";
const IMPRESSIONS = "22222222-2222-2222-2222-222222222222";

const ctr: Expression = {
  kind: "binary", op: "*",
  left: {
    kind: "binary", op: "/",
    left: { kind: "column", columnId: CLICKS },
    right: { kind: "column", columnId: IMPRESSIONS },
  },
  right: { kind: "const", value: "100" },
};

function resolver(values: Record<string, string | null>) {
  return (columnId: string) => {
    const value = values[columnId];
    return value === undefined || value === null ? null : new Prisma.Decimal(value);
  };
}

describe("evaluate", () => {
  it("computes a nested expression", () => {
    const result = evaluate(ctr, resolver({ [CLICKS]: "25", [IMPRESSIONS]: "1000" }));
    expect(result?.toFixed(4)).toBe("2.5000");
  });
  it("returns null when an operand is null", () => {
    expect(evaluate(ctr, resolver({ [CLICKS]: "25", [IMPRESSIONS]: null }))).toBeNull();
  });
  it("returns null when a referenced column is unknown", () => {
    expect(evaluate(ctr, resolver({}))).toBeNull();
  });
  it("returns null on division by zero", () => {
    expect(evaluate(ctr, resolver({ [CLICKS]: "25", [IMPRESSIONS]: "0" }))).toBeNull();
  });
  it("keeps decimal precision on addition", () => {
    const sum: Expression = {
      kind: "binary", op: "+",
      left: { kind: "const", value: "0.1" }, right: { kind: "const", value: "0.2" },
    };
    expect(evaluate(sum, resolver({}))?.toFixed(4)).toBe("0.3000");
  });
  it("supports subtraction", () => {
    const diff: Expression = {
      kind: "binary", op: "-",
      left: { kind: "column", columnId: CLICKS }, right: { kind: "const", value: "5" },
    };
    expect(evaluate(diff, resolver({ [CLICKS]: "25" }))?.toFixed(4)).toBe("20.0000");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w apps/api -- test/formula/evaluate.test.ts`
Expected: FAIL — cannot resolve `src/formula/evaluate.js`.

- [ ] **Step 3: Write the implementation**

`apps/api/src/formula/evaluate.ts`:

```ts
import { Prisma } from "@prisma/client";
import type { Expression } from "./expression.schema.js";

export type ValueResolver = (columnId: string) => Prisma.Decimal | null;

/** Null is contagious: an empty operand makes the whole expression empty. */
export function evaluate(expression: Expression, resolve: ValueResolver): Prisma.Decimal | null {
  switch (expression.kind) {
    case "const":
      return new Prisma.Decimal(expression.value);
    case "column":
      return resolve(expression.columnId);
    case "binary": {
      const left = evaluate(expression.left, resolve);
      if (left === null) return null;
      const right = evaluate(expression.right, resolve);
      if (right === null) return null;
      switch (expression.op) {
        case "+": return left.plus(right);
        case "-": return left.minus(right);
        case "*": return left.times(right);
        // A day with zero impressions is ordinary data, not an error.
        case "/": return right.isZero() ? null : left.div(right);
      }
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w apps/api -- test/formula/evaluate.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/formula/evaluate.ts apps/api/test/formula/evaluate.test.ts
git commit -m "feat(formula): add expression evaluator"
```

---

### Task 4: Formula dependencies and validation

**Files:**
- Create: `apps/api/src/formula/dependencies.ts`
- Test: `apps/api/test/formula/dependencies.test.ts`

**Interfaces:**
- Consumes: `Expression`, `ValidationError`.
- Produces:
  - `interface ColumnRef { id: string; type: ColumnType; formula: Expression | null }`
  - `collectColumnRefs(expression: Expression): string[]`
  - `assertFormulaIsValid(columnId: string, formula: Expression, columns: ColumnRef[]): void`
  - `findDependents(columnId: string, columns: ColumnRef[]): ColumnRef[]`

- [ ] **Step 1: Write the failing test**

`apps/api/test/formula/dependencies.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  collectColumnRefs, assertFormulaIsValid, findDependents, type ColumnRef,
} from "../../src/formula/dependencies.js";
import type { Expression } from "../../src/formula/expression.schema.js";
import { ValidationError } from "../../src/errors.js";

const SPEND = "11111111-1111-1111-1111-111111111111";
const CLICKS = "22222222-2222-2222-2222-222222222222";
const CPC = "33333333-3333-3333-3333-333333333333";
const COMMENT = "44444444-4444-4444-4444-444444444444";
const NEW = "55555555-5555-5555-5555-555555555555";

const col = (columnId: string): Expression => ({ kind: "column", columnId });
const div = (left: Expression, right: Expression): Expression =>
  ({ kind: "binary", op: "/", left, right });

const columns: ColumnRef[] = [
  { id: SPEND, type: "MONEY", formula: null },
  { id: CLICKS, type: "NUMBER", formula: null },
  { id: CPC, type: "MONEY", formula: div(col(SPEND), col(CLICKS)) },
  { id: COMMENT, type: "TEXT", formula: null },
];

describe("collectColumnRefs", () => {
  it("collects every referenced column once", () => {
    expect(collectColumnRefs(div(col(SPEND), col(SPEND))).sort()).toEqual([SPEND]);
  });
  it("returns an empty list for a constant", () => {
    expect(collectColumnRefs({ kind: "const", value: "100" })).toEqual([]);
  });
});

describe("assertFormulaIsValid", () => {
  it("accepts a formula over entered columns", () => {
    expect(() => assertFormulaIsValid(NEW, div(col(SPEND), col(CLICKS)), columns)).not.toThrow();
  });
  it("accepts a reference to a computed column", () => {
    expect(() => assertFormulaIsValid(NEW, div(col(CPC), col(CLICKS)), columns)).not.toThrow();
  });
  it("rejects a reference to a column outside the campaign", () => {
    expect(() => assertFormulaIsValid(NEW, col("99999999-9999-9999-9999-999999999999"), columns))
      .toThrow(ValidationError);
  });
  it("rejects a self-reference", () => {
    expect(() => assertFormulaIsValid(CPC, div(col(CPC), col(CLICKS)), columns))
      .toThrow(ValidationError);
  });
  it("rejects a reference to a text column", () => {
    expect(() => assertFormulaIsValid(NEW, div(col(COMMENT), col(CLICKS)), columns))
      .toThrow(ValidationError);
  });
  it("rejects a cycle through another column", () => {
    // SPEND would be redefined as SPEND = CPC / 2, while CPC = SPEND / CLICKS.
    expect(() => assertFormulaIsValid(SPEND, div(col(CPC), { kind: "const", value: "2" }), columns))
      .toThrow(ValidationError);
  });
});

describe("findDependents", () => {
  it("finds the columns whose formula uses a column", () => {
    expect(findDependents(SPEND, columns).map((c) => c.id)).toEqual([CPC]);
  });
  it("returns an empty list when nothing depends on the column", () => {
    expect(findDependents(COMMENT, columns)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w apps/api -- test/formula/dependencies.test.ts`
Expected: FAIL — cannot resolve `src/formula/dependencies.js`.

- [ ] **Step 3: Write the implementation**

`apps/api/src/formula/dependencies.ts`:

```ts
import type { ColumnType } from "@prisma/client";
import { ValidationError } from "../errors.js";
import type { Expression } from "./expression.schema.js";

export interface ColumnRef {
  id: string;
  type: ColumnType;
  formula: Expression | null;
}

export function collectColumnRefs(expression: Expression): string[] {
  const found = new Set<string>();
  const walk = (node: Expression): void => {
    if (node.kind === "column") found.add(node.columnId);
    if (node.kind === "binary") { walk(node.left); walk(node.right); }
  };
  walk(expression);
  return [...found];
}

/**
 * A formula may only reference numeric columns of the same campaign, may not
 * reference its own column, and may not close a reference cycle.
 */
export function assertFormulaIsValid(
  columnId: string,
  formula: Expression,
  columns: ColumnRef[],
): void {
  const byId = new Map(columns.map((column) => [column.id, column]));
  const refs = collectColumnRefs(formula);

  if (refs.includes(columnId)) {
    throw new ValidationError("Formula cannot reference its own column");
  }
  for (const ref of refs) {
    const column = byId.get(ref);
    if (!column) {
      throw new ValidationError(`Formula references a column outside this campaign: ${ref}`);
    }
    if (column.type === "TEXT") {
      throw new ValidationError(`Formula cannot reference the text column ${ref}`);
    }
  }

  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visited.has(id)) return;
    visited.add(id);
    const column = byId.get(id);
    if (!column?.formula) return;
    for (const ref of collectColumnRefs(column.formula)) {
      if (ref === columnId) throw new ValidationError("Formula creates a circular reference");
      visit(ref);
    }
  };
  for (const ref of refs) visit(ref);
}

export function findDependents(columnId: string, columns: ColumnRef[]): ColumnRef[] {
  return columns.filter(
    (column) => column.formula !== null && collectColumnRefs(column.formula).includes(columnId),
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w apps/api -- test/formula/dependencies.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/formula/dependencies.ts apps/api/test/formula/dependencies.test.ts
git commit -m "feat(formula): validate references and detect cycles"
```

---

### Task 5: Default columns

**Files:**
- Create: `apps/api/src/campaigns/defaults.ts`
- Test: `apps/api/test/campaigns/defaults.test.ts`

**Interfaces:**
- Consumes: `Expression`.
- Produces:
  - `interface DefaultColumnSeed { id: string; key: string; name: string; type: ColumnType; position: number; formula: Expression | null }`
  - `buildDefaultColumns(): DefaultColumnSeed[]` — 11 columns, fresh uuids on every call, formulas already wired to those uuids.

- [ ] **Step 1: Write the failing test**

`apps/api/test/campaigns/defaults.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildDefaultColumns } from "../../src/campaigns/defaults.js";
import { collectColumnRefs } from "../../src/formula/dependencies.js";
import { expressionSchema } from "../../src/formula/expression.schema.js";

describe("buildDefaultColumns", () => {
  const columns = buildDefaultColumns();
  const byKey = new Map(columns.map((column) => [column.key, column]));

  it("returns the eleven default columns in order", () => {
    expect(columns.map((column) => column.key)).toEqual([
      "spend", "impressions", "clicks", "ctr", "cpm", "cpc",
      "leads", "cpl", "revenue", "roas", "comment",
    ]);
    expect(columns.map((column) => column.position)).toEqual([0,1,2,3,4,5,6,7,8,9,10]);
  });

  it("marks entered columns with a null formula", () => {
    for (const key of ["spend", "impressions", "clicks", "leads", "revenue", "comment"]) {
      expect(byKey.get(key)?.formula).toBeNull();
    }
  });

  it("wires CTR to clicks and impressions", () => {
    const ctr = byKey.get("ctr");
    expect(ctr?.type).toBe("PERCENT");
    expect(collectColumnRefs(ctr!.formula!).sort()).toEqual(
      [byKey.get("clicks")!.id, byKey.get("impressions")!.id].sort(),
    );
  });

  it("wires ROAS to revenue and spend", () => {
    expect(collectColumnRefs(byKey.get("roas")!.formula!).sort()).toEqual(
      [byKey.get("revenue")!.id, byKey.get("spend")!.id].sort(),
    );
  });

  it("produces formulas that satisfy the expression schema", () => {
    for (const column of columns) {
      if (column.formula) expect(() => expressionSchema.parse(column.formula)).not.toThrow();
    }
  });

  it("produces fresh ids on every call", () => {
    expect(buildDefaultColumns()[0].id).not.toBe(columns[0].id);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w apps/api -- test/campaigns/defaults.test.ts`
Expected: FAIL — cannot resolve `src/campaigns/defaults.js`.

- [ ] **Step 3: Write the implementation**

`apps/api/src/campaigns/defaults.ts`:

```ts
import { randomUUID } from "node:crypto";
import type { ColumnType } from "@prisma/client";
import type { Expression } from "../formula/expression.schema.js";

export interface DefaultColumnSeed {
  id: string;
  key: string;
  name: string;
  type: ColumnType;
  position: number;
  formula: Expression | null;
}

const col = (columnId: string): Expression => ({ kind: "column", columnId });
const num = (value: string): Expression => ({ kind: "const", value });
const div = (left: Expression, right: Expression): Expression =>
  ({ kind: "binary", op: "/", left, right });
const mul = (left: Expression, right: Expression): Expression =>
  ({ kind: "binary", op: "*", left, right });

/**
 * The column set a campaign starts with. Ids are generated up front so the
 * computed columns can reference the entered ones inside a single insert.
 */
export function buildDefaultColumns(): DefaultColumnSeed[] {
  const spend = randomUUID();
  const impressions = randomUUID();
  const clicks = randomUUID();
  const leads = randomUUID();
  const revenue = randomUUID();

  return [
    { id: spend, key: "spend", name: "SPEND", type: "MONEY", position: 0, formula: null },
    { id: impressions, key: "impressions", name: "IMPRESSIONS", type: "NUMBER", position: 1, formula: null },
    { id: clicks, key: "clicks", name: "CLICKS", type: "NUMBER", position: 2, formula: null },
    { id: randomUUID(), key: "ctr", name: "CTR", type: "PERCENT", position: 3,
      formula: mul(div(col(clicks), col(impressions)), num("100")) },
    { id: randomUUID(), key: "cpm", name: "CPM", type: "MONEY", position: 4,
      formula: mul(div(col(spend), col(impressions)), num("1000")) },
    { id: randomUUID(), key: "cpc", name: "CPC", type: "MONEY", position: 5,
      formula: div(col(spend), col(clicks)) },
    { id: leads, key: "leads", name: "LEADS", type: "NUMBER", position: 6, formula: null },
    { id: randomUUID(), key: "cpl", name: "CPL", type: "MONEY", position: 7,
      formula: div(col(spend), col(leads)) },
    { id: revenue, key: "revenue", name: "REVENUE", type: "MONEY", position: 8, formula: null },
    { id: randomUUID(), key: "roas", name: "ROAS", type: "NUMBER", position: 9,
      formula: div(col(revenue), col(spend)) },
    { id: randomUUID(), key: "comment", name: "COMMENT", type: "TEXT", position: 10, formula: null },
  ];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w apps/api -- test/campaigns/defaults.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/campaigns/defaults.ts apps/api/test/campaigns/defaults.test.ts
git commit -m "feat(campaigns): add default column set"
```

---

### Task 6: Table rendering and totals

**Files:**
- Create: `apps/api/src/formula/table.ts`
- Test: `apps/api/test/formula/table.test.ts`

**Interfaces:**
- Consumes: `evaluate`, `Expression`.
- Produces:
  - `interface TableColumn { id: string; key: string | null; name: string; type: ColumnType; position: number; formula: Expression | null }`
  - `interface TableCell { columnId: string; numberValue: Prisma.Decimal | null; textValue: string | null }`
  - `interface TableRow { id: string; date: Date; cells: TableCell[] }`
  - `interface RenderedRow { id: string; date: string; values: Record<string, string | null> }`
  - `interface RenderedTable { rows: RenderedRow[]; totals: Record<string, string | null> }`
  - `buildTable(columns: TableColumn[], rows: TableRow[]): RenderedTable`

- [ ] **Step 1: Write the failing test**

`apps/api/test/formula/table.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { buildTable, type TableColumn, type TableRow } from "../../src/formula/table.js";
import type { Expression } from "../../src/formula/expression.schema.js";

const SPEND = "11111111-1111-1111-1111-111111111111";
const IMPRESSIONS = "22222222-2222-2222-2222-222222222222";
const CLICKS = "33333333-3333-3333-3333-333333333333";
const CTR = "44444444-4444-4444-4444-444444444444";
const COMMENT = "55555555-5555-5555-5555-555555555555";
const RATE = "66666666-6666-6666-6666-666666666666";

const col = (columnId: string): Expression => ({ kind: "column", columnId });
const ctrFormula: Expression = {
  kind: "binary", op: "*",
  left: { kind: "binary", op: "/", left: col(CLICKS), right: col(IMPRESSIONS) },
  right: { kind: "const", value: "100" },
};

const columns: TableColumn[] = [
  { id: SPEND, key: "spend", name: "SPEND", type: "MONEY", position: 0, formula: null },
  { id: IMPRESSIONS, key: "impressions", name: "IMPRESSIONS", type: "NUMBER", position: 1, formula: null },
  { id: CLICKS, key: "clicks", name: "CLICKS", type: "NUMBER", position: 2, formula: null },
  { id: CTR, key: "ctr", name: "CTR", type: "PERCENT", position: 3, formula: ctrFormula },
  { id: COMMENT, key: "comment", name: "COMMENT", type: "TEXT", position: 4, formula: null },
  { id: RATE, key: null, name: "RATE", type: "PERCENT", position: 5, formula: null },
];

function row(id: string, date: string, cells: Record<string, string | null>, text?: string): TableRow {
  return {
    id,
    date: new Date(`${date}T00:00:00.000Z`),
    cells: [
      ...Object.entries(cells).map(([columnId, value]) => ({
        columnId,
        numberValue: value === null ? null : new Prisma.Decimal(value),
        textValue: null,
      })),
      ...(text === undefined ? [] : [{ columnId: COMMENT, numberValue: null, textValue: text }]),
    ],
  };
}

describe("buildTable", () => {
  it("renders entered values and computes derived ones", () => {
    const table = buildTable(columns, [
      row("r1", "2026-07-21", { [SPEND]: "150.5", [IMPRESSIONS]: "1000", [CLICKS]: "25" }, "good day"),
    ]);
    expect(table.rows[0].date).toBe("2026-07-21");
    expect(table.rows[0].values[SPEND]).toBe("150.5000");
    expect(table.rows[0].values[CTR]).toBe("2.5000");
    expect(table.rows[0].values[COMMENT]).toBe("good day");
  });

  it("renders an untouched day as nulls everywhere", () => {
    const table = buildTable(columns, [row("r1", "2026-07-21", {})]);
    for (const column of columns) expect(table.rows[0].values[column.id]).toBeNull();
  });

  it("computes derived totals from the sums, not from the daily averages", () => {
    const table = buildTable(columns, [
      row("r1", "2026-07-21", { [IMPRESSIONS]: "1000", [CLICKS]: "10" }),
      row("r2", "2026-07-22", { [IMPRESSIONS]: "9000", [CLICKS]: "90" }),
    ]);
    // Σ clicks / Σ impressions = 100 / 10000 = 1%, which equals the weighted value.
    expect(table.totals[CTR]).toBe("1.0000");
    expect(table.totals[IMPRESSIONS]).toBe("10000.0000");
  });

  it("sums money columns and averages entered percent columns", () => {
    const table = buildTable(columns, [
      row("r1", "2026-07-21", { [SPEND]: "100.25", [RATE]: "10" }),
      row("r2", "2026-07-22", { [SPEND]: "200.25", [RATE]: "20" }),
    ]);
    expect(table.totals[SPEND]).toBe("300.5000");
    expect(table.totals[RATE]).toBe("15.0000");
  });

  it("leaves text totals null", () => {
    const table = buildTable(columns, [row("r1", "2026-07-21", {}, "note")]);
    expect(table.totals[COMMENT]).toBeNull();
  });

  it("returns null totals for a campaign with no rows", () => {
    const table = buildTable(columns, []);
    expect(table.rows).toEqual([]);
    for (const column of columns) expect(table.totals[column.id]).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w apps/api -- test/formula/table.test.ts`
Expected: FAIL — cannot resolve `src/formula/table.js`.

- [ ] **Step 3: Write the implementation**

`apps/api/src/formula/table.ts`:

```ts
import { Prisma, type ColumnType } from "@prisma/client";
import { evaluate, type ValueResolver } from "./evaluate.js";
import type { Expression } from "./expression.schema.js";

const SCALE = 4;

export interface TableColumn {
  id: string;
  key: string | null;
  name: string;
  type: ColumnType;
  position: number;
  formula: Expression | null;
}

export interface TableCell {
  columnId: string;
  numberValue: Prisma.Decimal | null;
  textValue: string | null;
}

export interface TableRow {
  id: string;
  date: Date;
  cells: TableCell[];
}

export interface RenderedRow {
  id: string;
  date: string;
  values: Record<string, string | null>;
}

export interface RenderedTable {
  rows: RenderedRow[];
  totals: Record<string, string | null>;
}

function format(value: Prisma.Decimal | null): string | null {
  return value === null ? null : value.toFixed(SCALE);
}

/**
 * Resolves a column to a number: entered columns read from `entered`, computed
 * columns evaluate their formula through the same resolver. Cycles are rejected
 * when a formula is saved, so the recursion always terminates; results are memoized
 * so a shared operand is evaluated once per row.
 */
function makeResolver(
  columns: TableColumn[],
  entered: Map<string, Prisma.Decimal | null>,
): ValueResolver {
  const byId = new Map(columns.map((column) => [column.id, column]));
  const cache = new Map<string, Prisma.Decimal | null>();

  const resolve: ValueResolver = (columnId) => {
    const cached = cache.get(columnId);
    if (cached !== undefined) return cached;
    cache.set(columnId, null); // guards against re-entry while evaluating

    const column = byId.get(columnId);
    let value: Prisma.Decimal | null = null;
    if (column && column.type !== "TEXT") {
      value = column.formula
        ? evaluate(column.formula, resolve)
        : entered.get(columnId) ?? null;
    }
    cache.set(columnId, value);
    return value;
  };

  return resolve;
}

export function buildTable(columns: TableColumn[], rows: TableRow[]): RenderedTable {
  const renderedRows = rows.map((row) => {
    const entered = new Map<string, Prisma.Decimal | null>();
    const texts = new Map<string, string | null>();
    for (const cell of row.cells) {
      entered.set(cell.columnId, cell.numberValue);
      texts.set(cell.columnId, cell.textValue);
    }
    const resolve = makeResolver(columns, entered);

    const values: Record<string, string | null> = {};
    for (const column of columns) {
      values[column.id] = column.type === "TEXT"
        ? texts.get(column.id) ?? null
        : format(resolve(column.id));
    }
    return { id: row.id, date: row.date.toISOString().slice(0, 10), values };
  });

  const aggregated = new Map<string, Prisma.Decimal | null>();
  for (const column of columns) {
    if (column.formula !== null || column.type === "TEXT") continue;
    const values = rows
      .flatMap((row) => row.cells.filter((cell) => cell.columnId === column.id))
      .map((cell) => cell.numberValue)
      .filter((value): value is Prisma.Decimal => value !== null);
    if (values.length === 0) {
      aggregated.set(column.id, null);
      continue;
    }
    const sum = values.reduce((acc, value) => acc.plus(value), new Prisma.Decimal(0));
    aggregated.set(column.id, column.type === "PERCENT" ? sum.div(values.length) : sum);
  }

  const resolveTotals = makeResolver(columns, aggregated);
  const totals: Record<string, string | null> = {};
  for (const column of columns) {
    totals[column.id] = column.type === "TEXT" ? null : format(resolveTotals(column.id));
  }

  return { rows: renderedRows, totals };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w apps/api -- test/formula/table.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/formula/table.ts apps/api/test/formula/table.test.ts
git commit -m "feat(formula): render table values and totals"
```

---

### Task 7: Campaign service

**Files:**
- Create: `apps/api/src/campaigns/campaign.service.ts`
- Test: `apps/api/test/campaigns/campaign.service.test.ts`

**Interfaces:**
- Consumes: `buildDefaultColumns`, `buildTable`, `fromJson`/`toJson`, `NotFoundError`.
- Produces:
  - `interface CampaignPayload { id: string; clientId: string; name: string; position: number; columns: TableColumn[]; rows: RenderedRow[]; totals: Record<string, string | null> }`
  - `createCampaign(clientId: string, input: { name: string }): Promise<Campaign>`
  - `listCampaigns(clientId: string): Promise<Campaign[]>`
  - `getCampaign(id: string): Promise<Campaign>`
  - `getCampaignTable(id: string): Promise<CampaignPayload>`
  - `updateCampaign(id: string, input: { name?: string; position?: number }): Promise<Campaign>`
  - `deleteCampaign(id: string): Promise<void>`
  - `normalizePositions(clientId: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

`apps/api/test/campaigns/campaign.service.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { resetDb } from "../helpers/db.js";
import { NotFoundError } from "../../src/errors.js";
import {
  createCampaign, listCampaigns, getCampaign, getCampaignTable,
  updateCampaign, deleteCampaign,
} from "../../src/campaigns/campaign.service.js";

const MISSING = "00000000-0000-0000-0000-000000000000";

let clientId: string;

beforeEach(async () => {
  await resetDb();
  const client = await prisma.client.create({ data: { name: "Acme" } });
  clientId = client.id;
});
afterAll(async () => { await prisma.$disconnect(); });

describe("campaign.service", () => {
  it("creates a campaign with the default columns", async () => {
    const campaign = await createCampaign(clientId, { name: "Facebook — July" });
    const columns = await prisma.campaignColumn.findMany({
      where: { campaignId: campaign.id }, orderBy: { position: "asc" },
    });
    expect(campaign.position).toBe(0);
    expect(columns).toHaveLength(11);
    expect(columns.map((column) => column.key)).toEqual([
      "spend", "impressions", "clicks", "ctr", "cpm", "cpc",
      "leads", "cpl", "revenue", "roas", "comment",
    ]);
    expect(columns[3].formula).toBeTruthy();
  });

  it("throws NotFoundError for a missing client", async () => {
    await expect(createCampaign(MISSING, { name: "X" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("appends new campaigns at the end and lists them by position", async () => {
    await createCampaign(clientId, { name: "A" });
    await createCampaign(clientId, { name: "B" });
    expect((await listCampaigns(clientId)).map((c) => c.name)).toEqual(["A", "B"]);
  });

  it("moves a campaign and renumbers its siblings", async () => {
    const a = await createCampaign(clientId, { name: "A" });
    await createCampaign(clientId, { name: "B" });
    await createCampaign(clientId, { name: "C" });
    await updateCampaign(a.id, { position: 2 });
    const listed = await listCampaigns(clientId);
    expect(listed.map((c) => c.name)).toEqual(["B", "C", "A"]);
    expect(listed.map((c) => c.position)).toEqual([0, 1, 2]);
  });

  it("renumbers the remaining campaigns after a delete", async () => {
    const a = await createCampaign(clientId, { name: "A" });
    await createCampaign(clientId, { name: "B" });
    await deleteCampaign(a.id);
    expect((await listCampaigns(clientId)).map((c) => c.position)).toEqual([0]);
  });

  it("getCampaign throws NotFoundError", async () => {
    await expect(getCampaign(MISSING)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("renames a campaign", async () => {
    const campaign = await createCampaign(clientId, { name: "A" });
    expect((await updateCampaign(campaign.id, { name: "B" })).name).toBe("B");
  });

  it("returns a table payload with columns, rows and totals", async () => {
    const campaign = await createCampaign(clientId, { name: "A" });
    const columns = await prisma.campaignColumn.findMany({ where: { campaignId: campaign.id } });
    const byKey = new Map(columns.map((column) => [column.key, column]));
    const row = await prisma.campaignRow.create({
      data: { campaignId: campaign.id, date: new Date("2026-07-21T00:00:00.000Z") },
    });
    await prisma.campaignCell.createMany({
      data: [
        { rowId: row.id, columnId: byKey.get("clicks")!.id, numberValue: "25" },
        { rowId: row.id, columnId: byKey.get("impressions")!.id, numberValue: "1000" },
      ],
    });

    const payload = await getCampaignTable(campaign.id);
    expect(payload.columns).toHaveLength(11);
    expect(payload.rows[0].date).toBe("2026-07-21");
    expect(payload.rows[0].values[byKey.get("ctr")!.id]).toBe("2.5000");
    expect(payload.totals[byKey.get("clicks")!.id]).toBe("25.0000");
  });

  it("getCampaignTable throws NotFoundError", async () => {
    await expect(getCampaignTable(MISSING)).rejects.toBeInstanceOf(NotFoundError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w apps/api -- test/campaigns/campaign.service.test.ts`
Expected: FAIL — cannot resolve `src/campaigns/campaign.service.js`.

- [ ] **Step 3: Write the implementation**

`apps/api/src/campaigns/campaign.service.ts`:

```ts
import type { Campaign } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { NotFoundError } from "../errors.js";
import { buildDefaultColumns } from "./defaults.js";
import { fromJson, toJson } from "../formula/expression.schema.js";
import { buildTable, type RenderedRow, type TableColumn } from "../formula/table.js";

export interface CampaignPayload {
  id: string;
  clientId: string;
  name: string;
  position: number;
  columns: TableColumn[];
  rows: RenderedRow[];
  totals: Record<string, string | null>;
}

async function assertClientExists(clientId: string): Promise<void> {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new NotFoundError("Client not found");
}

export async function createCampaign(
  clientId: string,
  input: { name: string },
): Promise<Campaign> {
  await assertClientExists(clientId);
  const position = await prisma.campaign.count({ where: { clientId } });
  return prisma.campaign.create({
    data: {
      clientId,
      name: input.name,
      position,
      columns: {
        create: buildDefaultColumns().map((column) => ({
          id: column.id,
          key: column.key,
          name: column.name,
          type: column.type,
          position: column.position,
          formula: toJson(column.formula),
        })),
      },
    },
  });
}

export async function listCampaigns(clientId: string): Promise<Campaign[]> {
  await assertClientExists(clientId);
  return prisma.campaign.findMany({ where: { clientId }, orderBy: { position: "asc" } });
}

export async function getCampaign(id: string): Promise<Campaign> {
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) throw new NotFoundError("Campaign not found");
  return campaign;
}

export async function getCampaignTable(id: string): Promise<CampaignPayload> {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      columns: { orderBy: { position: "asc" } },
      rows: { orderBy: { date: "asc" }, include: { cells: true } },
    },
  });
  if (!campaign) throw new NotFoundError("Campaign not found");

  const columns: TableColumn[] = campaign.columns.map((column) => ({
    id: column.id,
    key: column.key,
    name: column.name,
    type: column.type,
    position: column.position,
    formula: fromJson(column.formula),
  }));
  const { rows, totals } = buildTable(columns, campaign.rows);

  return {
    id: campaign.id,
    clientId: campaign.clientId,
    name: campaign.name,
    position: campaign.position,
    columns,
    rows,
    totals,
  };
}

/** Rewrites positions to a dense 0..n-1 sequence, optionally moving one campaign. */
async function reorder(clientId: string, movedId?: string, position?: number): Promise<void> {
  const siblings = await prisma.campaign.findMany({
    where: { clientId }, orderBy: { position: "asc" }, select: { id: true },
  });
  let ids = siblings.map((sibling) => sibling.id);
  if (movedId !== undefined && position !== undefined) {
    ids = ids.filter((id) => id !== movedId);
    const target = Math.max(0, Math.min(position, ids.length));
    ids.splice(target, 0, movedId);
  }
  await prisma.$transaction(
    ids.map((id, index) => prisma.campaign.update({ where: { id }, data: { position: index } })),
  );
}

export async function updateCampaign(
  id: string,
  input: { name?: string; position?: number },
): Promise<Campaign> {
  const campaign = await getCampaign(id);
  if (input.name !== undefined) {
    await prisma.campaign.update({ where: { id }, data: { name: input.name } });
  }
  if (input.position !== undefined) {
    await reorder(campaign.clientId, id, input.position);
  }
  return getCampaign(id);
}

export async function deleteCampaign(id: string): Promise<void> {
  const campaign = await getCampaign(id);
  await prisma.campaign.delete({ where: { id } });
  await reorder(campaign.clientId);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w apps/api -- test/campaigns/campaign.service.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/campaigns/campaign.service.ts apps/api/test/campaigns/campaign.service.test.ts
git commit -m "feat(campaigns): add campaign service"
```

---

### Task 8: Campaign API

**Files:**
- Create: `apps/api/src/campaigns/campaign.schema.ts`, `apps/api/src/campaigns/campaign.controller.ts`, `apps/api/src/campaigns/campaign.routes.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/test/campaigns/campaign.api.test.ts`

**Interfaces:**
- Consumes: the campaign service.
- Produces:
  - `createCampaignSchema`, `updateCampaignSchema`, types `CreateCampaignInput`, `UpdateCampaignInput`
  - routers `clientCampaignRouter` (mounted at `/api/clients/:clientId/campaigns`) and `campaignRouter` (mounted at `/api/campaigns`)

- [ ] **Step 1: Write the failing test**

`apps/api/test/campaigns/campaign.api.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetDb } from "../helpers/db.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";

let clientId: string;

beforeEach(async () => {
  await resetDb();
  const client = await prisma.client.create({ data: { name: "Acme" } });
  clientId = client.id;
});
afterAll(async () => { await prisma.$disconnect(); });

describe("Campaigns API", () => {
  it("POST /api/clients/:clientId/campaigns creates (201)", async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/campaigns`).send({ name: "Facebook — July" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Facebook — July");
    expect(res.body.position).toBe(0);
  });

  it("POST with an empty name -> 400", async () => {
    const res = await request(app).post(`/api/clients/${clientId}/campaigns`).send({ name: "" });
    expect(res.status).toBe(400);
  });

  it("POST for a missing client -> 404", async () => {
    const res = await request(app).post(`/api/clients/${MISSING}/campaigns`).send({ name: "A" });
    expect(res.status).toBe(404);
  });

  it("GET /api/clients/:clientId/campaigns lists (200)", async () => {
    await request(app).post(`/api/clients/${clientId}/campaigns`).send({ name: "A" });
    const res = await request(app).get(`/api/clients/${clientId}/campaigns`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("GET /api/campaigns/:id returns columns, rows and totals (200)", async () => {
    const created = await request(app)
      .post(`/api/clients/${clientId}/campaigns`).send({ name: "A" });
    const res = await request(app).get(`/api/campaigns/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.columns).toHaveLength(11);
    expect(res.body.rows).toEqual([]);
    expect(Object.keys(res.body.totals)).toHaveLength(11);
    expect(res.body.columns[0]).toMatchObject({ key: "spend", type: "MONEY", position: 0 });
  });

  it("GET /api/campaigns/:id for a missing id -> 404", async () => {
    expect((await request(app).get(`/api/campaigns/${MISSING}`)).status).toBe(404);
  });

  it("PATCH /api/campaigns/:id renames (200)", async () => {
    const created = await request(app)
      .post(`/api/clients/${clientId}/campaigns`).send({ name: "A" });
    const res = await request(app).patch(`/api/campaigns/${created.body.id}`).send({ name: "B" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("B");
  });

  it("DELETE /api/campaigns/:id deletes (204)", async () => {
    const created = await request(app)
      .post(`/api/clients/${clientId}/campaigns`).send({ name: "A" });
    expect((await request(app).delete(`/api/campaigns/${created.body.id}`)).status).toBe(204);
    expect(await prisma.campaign.count()).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w apps/api -- test/campaigns/campaign.api.test.ts`
Expected: FAIL — every request returns 404, since `app.ts` does not mount any campaign router yet.

- [ ] **Step 3: Write the validation schemas**

`apps/api/src/campaigns/campaign.schema.ts`:

```ts
import { z } from "zod";

export const createCampaignSchema = z.object({
  name: z.string().min(1, "name is required"),
});

export const updateCampaignSchema = z.object({
  name: z.string().min(1, "name is required").optional(),
  position: z.number().int().min(0, "position must be >= 0").optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
```

- [ ] **Step 4: Write the controller and routes**

`apps/api/src/campaigns/campaign.controller.ts`:

```ts
import type { NextFunction, Request, Response } from "express";
import { createCampaignSchema, updateCampaignSchema } from "./campaign.schema.js";
import {
  createCampaign, listCampaigns, getCampaignTable, updateCampaign, deleteCampaign,
} from "./campaign.service.js";

export async function create(
  req: Request<{ clientId: string }>, res: Response, next: NextFunction,
) {
  try {
    const data = createCampaignSchema.parse(req.body);
    res.status(201).json(await createCampaign(req.params.clientId, data));
  } catch (e) { next(e); }
}

export async function list(
  req: Request<{ clientId: string }>, res: Response, next: NextFunction,
) {
  try {
    res.json(await listCampaigns(req.params.clientId));
  } catch (e) { next(e); }
}

export async function getOne(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    res.json(await getCampaignTable(req.params.id));
  } catch (e) { next(e); }
}

export async function update(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const data = updateCampaignSchema.parse(req.body);
    res.json(await updateCampaign(req.params.id, data));
  } catch (e) { next(e); }
}

export async function remove(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    await deleteCampaign(req.params.id);
    res.status(204).send();
  } catch (e) { next(e); }
}
```

`apps/api/src/campaigns/campaign.routes.ts`:

```ts
import { Router } from "express";
import * as controller from "./campaign.controller.js";

/** Mounted at /api/clients/:clientId/campaigns */
export const clientCampaignRouter = Router({ mergeParams: true });
clientCampaignRouter.post("/", controller.create);
clientCampaignRouter.get("/", controller.list);

/** Mounted at /api/campaigns */
export const campaignRouter = Router();
campaignRouter.get("/:id", controller.getOne);
campaignRouter.patch("/:id", controller.update);
campaignRouter.delete("/:id", controller.remove);
```

- [ ] **Step 5: Wire the routers into the app**

Replace `apps/api/src/app.ts`:

```ts
import express from "express";
import { clientRouter } from "./clients/client.routes.js";
import { campaignRouter, clientCampaignRouter } from "./campaigns/campaign.routes.js";
import { errorHandler } from "./middleware/error-handler.js";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/clients/:clientId/campaigns", clientCampaignRouter);
  app.use("/api/clients", clientRouter);
  app.use("/api/campaigns", campaignRouter);
  app.use(errorHandler);
  return app;
}

export default createApp;
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -w apps/api -- test/campaigns/campaign.api.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 7: Run the whole suite**

Run: `npm test`
Expected: PASS — the Phase 1 client tests still pass.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/campaigns apps/api/src/app.ts apps/api/test/campaigns/campaign.api.test.ts
git commit -m "feat(api): expose campaigns REST API"
```

---

### Task 9: Columns

**Files:**
- Create: `apps/api/src/columns/column.service.ts`, `column.schema.ts`, `column.controller.ts`, `column.routes.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/test/columns/column.service.test.ts`, `apps/api/test/columns/column.api.test.ts`

**Interfaces:**
- Consumes: `assertFormulaIsValid`, `findDependents`, `toJson`/`fromJson`, `ValidationError`, `ConflictError`, `NotFoundError`.
- Produces:
  - `createColumn(campaignId: string, input: { name: string; type: ColumnType; formula?: Expression | null; position?: number }): Promise<CampaignColumn>`
  - `updateColumn(id: string, input: { name?: string; type?: ColumnType; formula?: Expression | null; position?: number }): Promise<CampaignColumn>`
  - `deleteColumn(id: string): Promise<void>`
  - routers `campaignColumnRouter` (`/api/campaigns/:campaignId/columns`) and `columnRouter` (`/api/columns`)

- [ ] **Step 1: Write the failing service test**

`apps/api/test/columns/column.service.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { resetDb } from "../helpers/db.js";
import { ConflictError, NotFoundError, ValidationError } from "../../src/errors.js";
import { createCampaign } from "../../src/campaigns/campaign.service.js";
import { createColumn, updateColumn, deleteColumn } from "../../src/columns/column.service.js";
import type { Expression } from "../../src/formula/expression.schema.js";

const MISSING = "00000000-0000-0000-0000-000000000000";

let campaignId: string;
let columnIdByKey: Map<string | null, string>;

beforeEach(async () => {
  await resetDb();
  const client = await prisma.client.create({ data: { name: "Acme" } });
  const campaign = await createCampaign(client.id, { name: "A" });
  campaignId = campaign.id;
  const columns = await prisma.campaignColumn.findMany({ where: { campaignId } });
  columnIdByKey = new Map(columns.map((column) => [column.key, column.id]));
});
afterAll(async () => { await prisma.$disconnect(); });

const col = (columnId: string): Expression => ({ kind: "column", columnId });

describe("column.service", () => {
  it("appends a custom column at the end with a null key", async () => {
    const column = await createColumn(campaignId, { name: "FREQUENCY", type: "NUMBER" });
    expect(column.position).toBe(11);
    expect(column.key).toBeNull();
  });

  it("inserts at a position and shifts the following columns", async () => {
    const column = await createColumn(campaignId, { name: "NOTE", type: "TEXT", position: 0 });
    const columns = await prisma.campaignColumn.findMany({
      where: { campaignId }, orderBy: { position: "asc" },
    });
    expect(columns[0].id).toBe(column.id);
    expect(columns.map((c) => c.position)).toEqual([0,1,2,3,4,5,6,7,8,9,10,11]);
  });

  it("creates a column with a formula", async () => {
    const column = await createColumn(campaignId, {
      name: "DOUBLE SPEND", type: "MONEY",
      formula: { kind: "binary", op: "*", left: col(columnIdByKey.get("spend")!), right: { kind: "const", value: "2" } },
    });
    expect(column.formula).toBeTruthy();
  });

  it("rejects a formula referencing a text column", async () => {
    await expect(createColumn(campaignId, {
      name: "BAD", type: "NUMBER",
      formula: col(columnIdByKey.get("comment")!),
    })).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a formula on a text column", async () => {
    await expect(createColumn(campaignId, {
      name: "BAD", type: "TEXT", formula: col(columnIdByKey.get("spend")!),
    })).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a cyclic formula on update", async () => {
    // SPEND = CPC * CLICKS would close the cycle, since CPC = SPEND / CLICKS.
    await expect(updateColumn(columnIdByKey.get("spend")!, {
      formula: { kind: "binary", op: "*", left: col(columnIdByKey.get("cpc")!), right: col(columnIdByKey.get("clicks")!) },
    })).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses to attach a formula to a column that already has values", async () => {
    const row = await prisma.campaignRow.create({
      data: { campaignId, date: new Date("2026-07-21T00:00:00.000Z") },
    });
    await prisma.campaignCell.create({
      data: { rowId: row.id, columnId: columnIdByKey.get("clicks")!, numberValue: "10" },
    });
    await expect(updateColumn(columnIdByKey.get("clicks")!, {
      formula: { kind: "const", value: "1" },
    })).rejects.toBeInstanceOf(ConflictError);
  });

  it("clears a formula, turning the column into an entered one", async () => {
    const updated = await updateColumn(columnIdByKey.get("ctr")!, { formula: null });
    expect(updated.formula).toBeNull();
  });

  it("renames and retypes between numeric types", async () => {
    const updated = await updateColumn(columnIdByKey.get("clicks")!, {
      name: "TOTAL CLICKS", type: "MONEY",
    });
    expect(updated.name).toBe("TOTAL CLICKS");
    expect(updated.type).toBe("MONEY");
  });

  it("refuses to switch between text and numeric while values exist", async () => {
    const row = await prisma.campaignRow.create({
      data: { campaignId, date: new Date("2026-07-21T00:00:00.000Z") },
    });
    await prisma.campaignCell.create({
      data: { rowId: row.id, columnId: columnIdByKey.get("comment")!, textValue: "note" },
    });
    await expect(updateColumn(columnIdByKey.get("comment")!, { type: "NUMBER" }))
      .rejects.toBeInstanceOf(ConflictError);
  });

  it("moves a column and renumbers the rest", async () => {
    await updateColumn(columnIdByKey.get("comment")!, { position: 0 });
    const columns = await prisma.campaignColumn.findMany({
      where: { campaignId }, orderBy: { position: "asc" },
    });
    expect(columns[0].key).toBe("comment");
    expect(columns.map((c) => c.position)).toEqual([0,1,2,3,4,5,6,7,8,9,10]);
  });

  it("refuses to delete a column used by a formula", async () => {
    await expect(deleteColumn(columnIdByKey.get("spend")!)).rejects.toBeInstanceOf(ConflictError);
  });

  it("deletes an unused column and renumbers the rest", async () => {
    await deleteColumn(columnIdByKey.get("comment")!);
    const columns = await prisma.campaignColumn.findMany({
      where: { campaignId }, orderBy: { position: "asc" },
    });
    expect(columns).toHaveLength(10);
    expect(columns.map((c) => c.position)).toEqual([0,1,2,3,4,5,6,7,8,9]);
  });

  it("throws NotFoundError for a missing campaign or column", async () => {
    await expect(createColumn(MISSING, { name: "X", type: "NUMBER" }))
      .rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteColumn(MISSING)).rejects.toBeInstanceOf(NotFoundError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w apps/api -- test/columns/column.service.test.ts`
Expected: FAIL — cannot resolve `src/columns/column.service.js`.

- [ ] **Step 3: Write the service**

`apps/api/src/columns/column.service.ts`:

```ts
import { randomUUID } from "node:crypto";
import type { CampaignColumn, ColumnType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ConflictError, NotFoundError, ValidationError } from "../errors.js";
import {
  assertFormulaIsValid, findDependents, type ColumnRef,
} from "../formula/dependencies.js";
import { fromJson, toJson, type Expression } from "../formula/expression.schema.js";

export interface CreateColumnInput {
  name: string;
  type: ColumnType;
  formula?: Expression | null;
  position?: number;
}

export interface UpdateColumnInput {
  name?: string;
  type?: ColumnType;
  formula?: Expression | null;
  position?: number;
}

function toColumnRef(column: CampaignColumn): ColumnRef {
  return { id: column.id, type: column.type, formula: fromJson(column.formula) };
}

async function getColumn(id: string): Promise<CampaignColumn> {
  const column = await prisma.campaignColumn.findUnique({ where: { id } });
  if (!column) throw new NotFoundError("Column not found");
  return column;
}

async function siblings(campaignId: string): Promise<CampaignColumn[]> {
  return prisma.campaignColumn.findMany({ where: { campaignId }, orderBy: { position: "asc" } });
}

/** Rewrites positions to a dense 0..n-1 sequence, optionally moving one column. */
async function reorder(campaignId: string, movedId?: string, position?: number): Promise<void> {
  const current = await siblings(campaignId);
  let ids = current.map((column) => column.id);
  if (movedId !== undefined && position !== undefined) {
    ids = ids.filter((id) => id !== movedId);
    const target = Math.max(0, Math.min(position, ids.length));
    ids.splice(target, 0, movedId);
  }
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.campaignColumn.update({ where: { id }, data: { position: index } })),
  );
}

async function countValues(columnId: string): Promise<number> {
  return prisma.campaignCell.count({ where: { columnId } });
}

export async function createColumn(
  campaignId: string,
  input: CreateColumnInput,
): Promise<CampaignColumn> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new NotFoundError("Campaign not found");

  const existing = await siblings(campaignId);
  const id = randomUUID();
  const formula = input.formula ?? null;
  if (formula) {
    if (input.type === "TEXT") throw new ValidationError("A text column cannot have a formula");
    assertFormulaIsValid(id, formula, existing.map(toColumnRef));
  }

  const position = Math.max(0, Math.min(input.position ?? existing.length, existing.length));
  await prisma.$transaction([
    prisma.campaignColumn.updateMany({
      where: { campaignId, position: { gte: position } },
      data: { position: { increment: 1 } },
    }),
    prisma.campaignColumn.create({
      data: {
        id, campaignId, key: null, name: input.name, type: input.type, position,
        formula: toJson(formula),
      },
    }),
  ]);
  return getColumn(id);
}

export async function updateColumn(
  id: string,
  input: UpdateColumnInput,
): Promise<CampaignColumn> {
  const column = await getColumn(id);
  const existing = await siblings(column.campaignId);
  const nextType = input.type ?? column.type;

  if (input.type !== undefined && input.type !== column.type) {
    const crossesTextBoundary = (input.type === "TEXT") !== (column.type === "TEXT");
    if (crossesTextBoundary && (await countValues(id)) > 0) {
      throw new ConflictError("Column has entered values; clear them before changing its type");
    }
  }

  if (input.formula !== undefined && input.formula !== null) {
    if (nextType === "TEXT") throw new ValidationError("A text column cannot have a formula");
    if ((await countValues(id)) > 0) {
      throw new ConflictError("Column has entered values; clear them before adding a formula");
    }
    assertFormulaIsValid(id, input.formula, existing.map(toColumnRef));
  }
  // `formula: null` turns a computed column back into an entered one — always allowed.

  const data: { name?: string; type?: ColumnType; formula?: ReturnType<typeof toJson> } = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.type !== undefined) data.type = input.type;
  if (input.formula !== undefined) data.formula = toJson(input.formula);
  if (Object.keys(data).length > 0) {
    await prisma.campaignColumn.update({ where: { id }, data });
  }
  if (input.position !== undefined) {
    await reorder(column.campaignId, id, input.position);
  }
  return getColumn(id);
}

export async function deleteColumn(id: string): Promise<void> {
  const column = await getColumn(id);
  const existing = await siblings(column.campaignId);
  const dependents = findDependents(id, existing.map(toColumnRef));
  if (dependents.length > 0) {
    const names = existing
      .filter((sibling) => dependents.some((dependent) => dependent.id === sibling.id))
      .map((sibling) => sibling.name)
      .join(", ");
    throw new ConflictError(`Column is used by the formula of: ${names}`);
  }
  await prisma.campaignColumn.delete({ where: { id } });
  await reorder(column.campaignId);
}
```

- [ ] **Step 4: Run the service test to verify it passes**

Run: `npm test -w apps/api -- test/columns/column.service.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 5: Write the failing API test**

`apps/api/test/columns/column.api.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetDb } from "../helpers/db.js";
import { createCampaign } from "../../src/campaigns/campaign.service.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";

let campaignId: string;
let columnIdByKey: Map<string | null, string>;

beforeEach(async () => {
  await resetDb();
  const client = await prisma.client.create({ data: { name: "Acme" } });
  const campaign = await createCampaign(client.id, { name: "A" });
  campaignId = campaign.id;
  const columns = await prisma.campaignColumn.findMany({ where: { campaignId } });
  columnIdByKey = new Map(columns.map((column) => [column.key, column.id]));
});
afterAll(async () => { await prisma.$disconnect(); });

describe("Columns API", () => {
  it("POST /api/campaigns/:campaignId/columns creates (201)", async () => {
    const res = await request(app)
      .post(`/api/campaigns/${campaignId}/columns`).send({ name: "FREQUENCY", type: "NUMBER" });
    expect(res.status).toBe(201);
    expect(res.body.position).toBe(11);
  });

  it("POST with an unknown type -> 400", async () => {
    const res = await request(app)
      .post(`/api/campaigns/${campaignId}/columns`).send({ name: "X", type: "DATE" });
    expect(res.status).toBe(400);
  });

  it("POST with a malformed formula -> 400", async () => {
    const res = await request(app).post(`/api/campaigns/${campaignId}/columns`)
      .send({ name: "X", type: "NUMBER", formula: { kind: "binary", op: "%" } });
    expect(res.status).toBe(400);
  });

  it("POST for a missing campaign -> 404", async () => {
    const res = await request(app)
      .post(`/api/campaigns/${MISSING}/columns`).send({ name: "X", type: "NUMBER" });
    expect(res.status).toBe(404);
  });

  it("PATCH /api/columns/:id renames (200)", async () => {
    const res = await request(app)
      .patch(`/api/columns/${columnIdByKey.get("clicks")}`).send({ name: "TOTAL CLICKS" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("TOTAL CLICKS");
  });

  it("DELETE /api/columns/:id for a column used by a formula -> 409", async () => {
    const res = await request(app).delete(`/api/columns/${columnIdByKey.get("spend")}`);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain("CPC");
  });

  it("DELETE /api/columns/:id deletes an unused column (204)", async () => {
    const res = await request(app).delete(`/api/columns/${columnIdByKey.get("comment")}`);
    expect(res.status).toBe(204);
  });

  it("DELETE /api/columns/:id for a missing id -> 404", async () => {
    expect((await request(app).delete(`/api/columns/${MISSING}`)).status).toBe(404);
  });
});
```

- [ ] **Step 6: Run the API test to verify it fails**

Run: `npm test -w apps/api -- test/columns/column.api.test.ts`
Expected: FAIL — 404 on every route, the routers do not exist yet.

- [ ] **Step 7: Write the schema, controller and routes**

`apps/api/src/columns/column.schema.ts`:

```ts
import { z } from "zod";
import { expressionSchema } from "../formula/expression.schema.js";

export const columnTypeSchema = z.enum(["NUMBER", "MONEY", "PERCENT", "TEXT"]);

export const createColumnSchema = z.object({
  name: z.string().min(1, "name is required"),
  type: columnTypeSchema,
  formula: expressionSchema.nullable().optional(),
  position: z.number().int().min(0, "position must be >= 0").optional(),
});

export const updateColumnSchema = z.object({
  name: z.string().min(1, "name is required").optional(),
  type: columnTypeSchema.optional(),
  formula: expressionSchema.nullable().optional(),
  position: z.number().int().min(0, "position must be >= 0").optional(),
});

export type CreateColumnInput = z.infer<typeof createColumnSchema>;
export type UpdateColumnInput = z.infer<typeof updateColumnSchema>;
```

`apps/api/src/columns/column.controller.ts`:

```ts
import type { NextFunction, Request, Response } from "express";
import { createColumnSchema, updateColumnSchema } from "./column.schema.js";
import { createColumn, updateColumn, deleteColumn } from "./column.service.js";

export async function create(
  req: Request<{ campaignId: string }>, res: Response, next: NextFunction,
) {
  try {
    const data = createColumnSchema.parse(req.body);
    res.status(201).json(await createColumn(req.params.campaignId, data));
  } catch (e) { next(e); }
}

export async function update(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const data = updateColumnSchema.parse(req.body);
    res.json(await updateColumn(req.params.id, data));
  } catch (e) { next(e); }
}

export async function remove(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    await deleteColumn(req.params.id);
    res.status(204).send();
  } catch (e) { next(e); }
}
```

`apps/api/src/columns/column.routes.ts`:

```ts
import { Router } from "express";
import * as controller from "./column.controller.js";

/** Mounted at /api/campaigns/:campaignId/columns */
export const campaignColumnRouter = Router({ mergeParams: true });
campaignColumnRouter.post("/", controller.create);

/** Mounted at /api/columns */
export const columnRouter = Router();
columnRouter.patch("/:id", controller.update);
columnRouter.delete("/:id", controller.remove);
```

- [ ] **Step 8: Wire the routers into the app**

In `apps/api/src/app.ts`, add the import and the two mounts (nested mount before `/api/campaigns`):

```ts
import { campaignColumnRouter, columnRouter } from "./columns/column.routes.js";
```

```ts
  app.use("/api/campaigns/:campaignId/columns", campaignColumnRouter);
  app.use("/api/campaigns", campaignRouter);
  app.use("/api/columns", columnRouter);
```

- [ ] **Step 9: Run the API test to verify it passes**

Run: `npm test -w apps/api -- test/columns/column.api.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/columns apps/api/src/app.ts apps/api/test/columns
git commit -m "feat(api): manage campaign columns"
```

---

### Task 10: Rows

**Files:**
- Create: `apps/api/src/rows/row.service.ts`, `row.schema.ts`, `row.controller.ts`, `row.routes.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/test/rows/row.api.test.ts`

**Interfaces:**
- Consumes: `NotFoundError`, `ConflictError`.
- Produces:
  - `parseDate(date: string): Date` — `YYYY-MM-DD` to a UTC midnight `Date`
  - `createRow(campaignId: string, input: { date: string }): Promise<CampaignRow>`
  - `updateRow(id: string, input: { date: string }): Promise<CampaignRow>`
  - `deleteRow(id: string): Promise<void>`
  - routers `campaignRowRouter` (`/api/campaigns/:campaignId/rows`) and `rowRouter` (`/api/rows`)

- [ ] **Step 1: Write the failing test**

`apps/api/test/rows/row.api.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetDb } from "../helpers/db.js";
import { createCampaign } from "../../src/campaigns/campaign.service.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";

let campaignId: string;

beforeEach(async () => {
  await resetDb();
  const client = await prisma.client.create({ data: { name: "Acme" } });
  campaignId = (await createCampaign(client.id, { name: "A" })).id;
});
afterAll(async () => { await prisma.$disconnect(); });

function addDay(date: string) {
  return request(app).post(`/api/campaigns/${campaignId}/rows`).send({ date });
}

describe("Rows API", () => {
  it("POST /api/campaigns/:campaignId/rows creates a day (201)", async () => {
    const res = await addDay("2026-07-21");
    expect(res.status).toBe(201);
    expect(res.body.date).toContain("2026-07-21");
  });

  it("POST with a duplicate date -> 409", async () => {
    await addDay("2026-07-21");
    const res = await addDay("2026-07-21");
    expect(res.status).toBe(409);
  });

  it("POST with a malformed date -> 400", async () => {
    const res = await addDay("21.07.2026");
    expect(res.status).toBe(400);
  });

  it("POST for a missing campaign -> 404", async () => {
    const res = await request(app)
      .post(`/api/campaigns/${MISSING}/rows`).send({ date: "2026-07-21" });
    expect(res.status).toBe(404);
  });

  it("PATCH /api/rows/:id moves the day (200)", async () => {
    const created = await addDay("2026-07-21");
    const res = await request(app).patch(`/api/rows/${created.body.id}`).send({ date: "2026-07-22" });
    expect(res.status).toBe(200);
    expect(res.body.date).toContain("2026-07-22");
  });

  it("PATCH onto an occupied date -> 409", async () => {
    const created = await addDay("2026-07-21");
    await addDay("2026-07-22");
    const res = await request(app).patch(`/api/rows/${created.body.id}`).send({ date: "2026-07-22" });
    expect(res.status).toBe(409);
  });

  it("DELETE /api/rows/:id deletes the day and its cells (204)", async () => {
    const created = await addDay("2026-07-21");
    const column = await prisma.campaignColumn.findFirstOrThrow({
      where: { campaignId, key: "clicks" },
    });
    await prisma.campaignCell.create({
      data: { rowId: created.body.id, columnId: column.id, numberValue: "10" },
    });
    expect((await request(app).delete(`/api/rows/${created.body.id}`)).status).toBe(204);
    expect(await prisma.campaignCell.count()).toBe(0);
  });

  it("DELETE /api/rows/:id for a missing id -> 404", async () => {
    expect((await request(app).delete(`/api/rows/${MISSING}`)).status).toBe(404);
  });

  it("returns rows in the campaign payload ordered by date", async () => {
    await addDay("2026-07-22");
    await addDay("2026-07-21");
    const res = await request(app).get(`/api/campaigns/${campaignId}`);
    expect(res.body.rows.map((row: { date: string }) => row.date))
      .toEqual(["2026-07-21", "2026-07-22"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w apps/api -- test/rows/row.api.test.ts`
Expected: FAIL — 404 on the row routes, they do not exist yet.

- [ ] **Step 3: Write the service**

`apps/api/src/rows/row.service.ts`:

```ts
import type { CampaignRow } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ConflictError, NotFoundError } from "../errors.js";

/** A day is stored as a pure date; UTC midnight keeps it stable across timezones. */
export function parseDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

async function getRow(id: string): Promise<CampaignRow> {
  const row = await prisma.campaignRow.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Row not found");
  return row;
}

async function assertDateIsFree(campaignId: string, date: Date, exceptRowId?: string) {
  const existing = await prisma.campaignRow.findUnique({
    where: { campaignId_date: { campaignId, date } },
  });
  if (existing && existing.id !== exceptRowId) {
    throw new ConflictError(`The campaign already has a row for ${date.toISOString().slice(0, 10)}`);
  }
}

export async function createRow(
  campaignId: string,
  input: { date: string },
): Promise<CampaignRow> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new NotFoundError("Campaign not found");
  const date = parseDate(input.date);
  await assertDateIsFree(campaignId, date);
  return prisma.campaignRow.create({ data: { campaignId, date } });
}

export async function updateRow(id: string, input: { date: string }): Promise<CampaignRow> {
  const row = await getRow(id);
  const date = parseDate(input.date);
  await assertDateIsFree(row.campaignId, date, id);
  return prisma.campaignRow.update({ where: { id }, data: { date } });
}

export async function deleteRow(id: string): Promise<void> {
  await getRow(id);
  await prisma.campaignRow.delete({ where: { id } });
}
```

- [ ] **Step 4: Write the schema, controller and routes**

`apps/api/src/rows/row.schema.ts`:

```ts
import { z } from "zod";

export const createRowSchema = z.object({
  date: z.iso.date("date must be in YYYY-MM-DD format"),
});

export const updateRowSchema = createRowSchema;

export type CreateRowInput = z.infer<typeof createRowSchema>;
export type UpdateRowInput = z.infer<typeof updateRowSchema>;
```

`apps/api/src/rows/row.controller.ts`:

```ts
import type { NextFunction, Request, Response } from "express";
import { createRowSchema, updateRowSchema } from "./row.schema.js";
import { createRow, updateRow, deleteRow } from "./row.service.js";

export async function create(
  req: Request<{ campaignId: string }>, res: Response, next: NextFunction,
) {
  try {
    const data = createRowSchema.parse(req.body);
    res.status(201).json(await createRow(req.params.campaignId, data));
  } catch (e) { next(e); }
}

export async function update(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const data = updateRowSchema.parse(req.body);
    res.json(await updateRow(req.params.id, data));
  } catch (e) { next(e); }
}

export async function remove(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    await deleteRow(req.params.id);
    res.status(204).send();
  } catch (e) { next(e); }
}
```

`apps/api/src/rows/row.routes.ts`:

```ts
import { Router } from "express";
import * as controller from "./row.controller.js";

/** Mounted at /api/campaigns/:campaignId/rows */
export const campaignRowRouter = Router({ mergeParams: true });
campaignRowRouter.post("/", controller.create);

/** Mounted at /api/rows */
export const rowRouter = Router();
rowRouter.patch("/:id", controller.update);
rowRouter.delete("/:id", controller.remove);
```

- [ ] **Step 5: Wire the routers into the app**

In `apps/api/src/app.ts` add:

```ts
import { campaignRowRouter, rowRouter } from "./rows/row.routes.js";
```

```ts
  app.use("/api/campaigns/:campaignId/rows", campaignRowRouter);
  app.use("/api/rows", rowRouter);
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -w apps/api -- test/rows/row.api.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/rows apps/api/src/app.ts apps/api/test/rows
git commit -m "feat(api): manage campaign days"
```

---

### Task 11: Cell writes

**Files:**
- Create: `apps/api/src/rows/cell.service.ts`, `cell.schema.ts`, `cell.controller.ts`
- Modify: `apps/api/src/rows/row.routes.ts`
- Test: `apps/api/test/rows/cell.api.test.ts`

**Interfaces:**
- Consumes: `getCampaignTable`, `ValidationError`, `NotFoundError`.
- Produces:
  - `setCellValue(rowId: string, columnId: string, value: string | number | null): Promise<{ row: RenderedRow; totals: Record<string, string | null> }>`
  - `PUT /api/rows/:rowId/cells/:columnId` on `rowRouter`

**Note:** the response carries the re-rendered row and the campaign totals. The spec left the response shape open; returning them saves the frontend a refetch after every edit, since one entered value changes several derived cells and the totals row.

- [ ] **Step 1: Write the failing test**

`apps/api/test/rows/cell.api.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetDb } from "../helpers/db.js";
import { createCampaign } from "../../src/campaigns/campaign.service.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";

let campaignId: string;
let rowId: string;
let columnIdByKey: Map<string | null, string>;

beforeEach(async () => {
  await resetDb();
  const client = await prisma.client.create({ data: { name: "Acme" } });
  campaignId = (await createCampaign(client.id, { name: "A" })).id;
  const columns = await prisma.campaignColumn.findMany({ where: { campaignId } });
  columnIdByKey = new Map(columns.map((column) => [column.key, column.id]));
  const row = await request(app)
    .post(`/api/campaigns/${campaignId}/rows`).send({ date: "2026-07-21" });
  rowId = row.body.id;
});
afterAll(async () => { await prisma.$disconnect(); });

function setCell(columnKey: string, value: unknown, targetRowId = rowId) {
  return request(app)
    .put(`/api/rows/${targetRowId}/cells/${columnIdByKey.get(columnKey)}`)
    .send({ value });
}

describe("Cells API", () => {
  it("writes a numeric value and recomputes the row (200)", async () => {
    await setCell("impressions", "1000");
    const res = await setCell("clicks", 25);
    expect(res.status).toBe(200);
    expect(res.body.row.values[columnIdByKey.get("clicks")!]).toBe("25.0000");
    expect(res.body.row.values[columnIdByKey.get("ctr")!]).toBe("2.5000");
    expect(res.body.totals[columnIdByKey.get("ctr")!]).toBe("2.5000");
  });

  it("is idempotent: repeating the same write keeps one cell", async () => {
    await setCell("clicks", 25);
    await setCell("clicks", 25);
    expect(await prisma.campaignCell.count()).toBe(1);
  });

  it("writes a text value", async () => {
    const res = await setCell("comment", "good day");
    expect(res.body.row.values[columnIdByKey.get("comment")!]).toBe("good day");
  });

  it("clears a cell with null", async () => {
    await setCell("clicks", 25);
    const res = await setCell("clicks", null);
    expect(res.body.row.values[columnIdByKey.get("clicks")!]).toBeNull();
    expect(await prisma.campaignCell.count()).toBe(0);
  });

  it("rejects a write to a computed column -> 400", async () => {
    const res = await setCell("ctr", 5);
    expect(res.status).toBe(400);
  });

  it("rejects text in a numeric column -> 400", async () => {
    const res = await setCell("clicks", "many");
    expect(res.status).toBe(400);
  });

  it("rejects a number in a text column -> 400", async () => {
    const res = await setCell("comment", 5);
    expect(res.status).toBe(400);
  });

  it("returns 404 for a missing row", async () => {
    const res = await setCell("clicks", 1, MISSING);
    expect(res.status).toBe(404);
  });

  it("returns 404 for a column of another campaign", async () => {
    const client = await prisma.client.create({ data: { name: "Other" } });
    const other = await createCampaign(client.id, { name: "B" });
    const foreign = await prisma.campaignColumn.findFirstOrThrow({
      where: { campaignId: other.id, key: "clicks" },
    });
    const res = await request(app)
      .put(`/api/rows/${rowId}/cells/${foreign.id}`).send({ value: 1 });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w apps/api -- test/rows/cell.api.test.ts`
Expected: FAIL — 404, the route does not exist yet.

- [ ] **Step 3: Write the service**

`apps/api/src/rows/cell.service.ts`:

```ts
import { prisma } from "../lib/prisma.js";
import { NotFoundError, ValidationError } from "../errors.js";
import { getCampaignTable } from "../campaigns/campaign.service.js";
import type { RenderedRow } from "../formula/table.js";

export interface CellWriteResult {
  row: RenderedRow;
  totals: Record<string, string | null>;
}

const DECIMAL = /^-?\d+(\.\d+)?$/;

export async function setCellValue(
  rowId: string,
  columnId: string,
  value: string | number | null,
): Promise<CellWriteResult> {
  const row = await prisma.campaignRow.findUnique({ where: { id: rowId } });
  if (!row) throw new NotFoundError("Row not found");

  const column = await prisma.campaignColumn.findUnique({ where: { id: columnId } });
  if (!column || column.campaignId !== row.campaignId) {
    throw new NotFoundError("Column not found in this campaign");
  }
  if (column.formula !== null) {
    throw new ValidationError("Cannot write to a computed column");
  }

  if (value === null) {
    await prisma.campaignCell.deleteMany({ where: { rowId, columnId } });
  } else if (column.type === "TEXT") {
    if (typeof value !== "string") throw new ValidationError("Column expects a text value");
    await prisma.campaignCell.upsert({
      where: { rowId_columnId: { rowId, columnId } },
      create: { rowId, columnId, textValue: value, numberValue: null },
      update: { textValue: value, numberValue: null },
    });
  } else {
    const numeric = typeof value === "number" ? String(value) : value;
    if (!DECIMAL.test(numeric)) throw new ValidationError("Column expects a numeric value");
    await prisma.campaignCell.upsert({
      where: { rowId_columnId: { rowId, columnId } },
      create: { rowId, columnId, numberValue: numeric, textValue: null },
      update: { numberValue: numeric, textValue: null },
    });
  }

  const table = await getCampaignTable(row.campaignId);
  const rendered = table.rows.find((candidate) => candidate.id === rowId);
  if (!rendered) throw new NotFoundError("Row not found");
  return { row: rendered, totals: table.totals };
}
```

- [ ] **Step 4: Write the schema, controller and route**

`apps/api/src/rows/cell.schema.ts`:

```ts
import { z } from "zod";

export const setCellSchema = z.object({
  value: z.union([z.string(), z.number(), z.null()]),
});

export type SetCellInput = z.infer<typeof setCellSchema>;
```

`apps/api/src/rows/cell.controller.ts`:

```ts
import type { NextFunction, Request, Response } from "express";
import { setCellSchema } from "./cell.schema.js";
import { setCellValue } from "./cell.service.js";

export async function set(
  req: Request<{ rowId: string; columnId: string }>, res: Response, next: NextFunction,
) {
  try {
    const { value } = setCellSchema.parse(req.body);
    res.json(await setCellValue(req.params.rowId, req.params.columnId, value));
  } catch (e) { next(e); }
}
```

Add to `apps/api/src/rows/row.routes.ts`:

```ts
import * as cellController from "./cell.controller.js";
```

```ts
rowRouter.put("/:rowId/cells/:columnId", cellController.set);
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -w apps/api -- test/rows/cell.api.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS, all suites.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/rows apps/api/test/rows/cell.api.test.ts
git commit -m "feat(api): edit campaign cell values"
```

---

### Task 12: Documentation

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the finished API.
- Produces: no code.

- [ ] **Step 1: Update the phase line**

Replace lines 6–7 of `README.md`:

```markdown
**Current phase:** Phase 2 — campaigns and the daily stats table. Authentication,
multi-tenancy, CSV import and AI analysis are deliberately out of scope for now.
```

- [ ] **Step 2: Update the project structure block**

In the structure block, replace the `prisma/schema.prisma` line and the `clients/` line:

```
      prisma/schema.prisma  # Client, Campaign, CampaignColumn, CampaignRow, CampaignCell
      src/
        app.ts              # builds the Express app (no listen) — used by tests
        server.ts           # entry point
        errors.ts           # domain errors
        lib/prisma.ts       # PrismaClient singleton
        middleware/         # unified error handling
        clients/            # routes -> controller -> service -> schema
        campaigns/          # campaign CRUD + the default column set
        columns/            # per-campaign column management
        rows/               # days and cell values
        formula/            # expression tree: schema, evaluator, table rendering
```

- [ ] **Step 3: Extend the API table**

Append to the API table in `README.md`, after the client rows:

```markdown
| POST | `/clients/:clientId/campaigns` | Create a campaign | 201 |
| GET | `/clients/:clientId/campaigns` | List a client's campaigns | 200 |
| GET | `/campaigns/:id` | Campaign with columns, rows and totals | 200 |
| PATCH | `/campaigns/:id` | Rename or reorder | 200 |
| DELETE | `/campaigns/:id` | Delete | 204 |
| POST | `/campaigns/:id/columns` | Add a column | 201 |
| PATCH | `/columns/:id` | Rename, retype, reorder, set a formula | 200 |
| DELETE | `/columns/:id` | Delete a column | 204 |
| POST | `/campaigns/:id/rows` | Add a day | 201 |
| PATCH | `/rows/:id` | Move a day to another date | 200 |
| DELETE | `/rows/:id` | Delete a day | 204 |
| PUT | `/rows/:rowId/cells/:columnId` | Write a cell value | 200 |
```

And replace the closing paragraph about error codes with:

```markdown
A campaign starts with eleven default columns (spend, impressions, clicks, CTR, CPM,
CPC, leads, CPL, revenue, ROAS, comment). Derived columns carry a formula — an
expression tree — and are computed on read, so only hand-entered values are stored.
Numeric values cross the API as strings with four decimals to preserve precision.

Validation failures return 400, a missing record returns 404, conflicts (a duplicate
date, deleting a column used by a formula) return 409, and anything unexpected
returns 500.
```

- [ ] **Step 4: Verify the suite is still green**

Run: `npm test`
Expected: PASS, all suites.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: document the campaigns API"
```
