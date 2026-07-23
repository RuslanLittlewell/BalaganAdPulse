# AdPulse Backend — Design (Phase 2: campaigns and the daily stats grid)

**Date:** 2026-07-21
**Status:** implemented

## Context

Phase 1 delivered client CRUD (see
[2026-07-20-adpulse-backend-clients-design.md](2026-07-20-adpulse-backend-clients-design.md)).

Phase 2 adds the core working surface of the product: a client owns several
**campaigns**, and each campaign holds one grid of daily statistics. Each **record**
is a day; each **property** is a metric. The media buyer types spend, impressions,
clicks, leads and revenue; derived metrics (CTR, CPM, CPC, CPL, ROAS) are computed.
Properties can be added, removed and reordered; days can be added and removed; entered
values are editable.

The stored entities follow the Notion/Airtable model rather than a spreadsheet: a
campaign has **properties** (the metric columns of the grid), **records** (the days),
and a **property value** for each hand-entered cell. The UI still presents them as a
grid; the domain model does not bind itself to that shape.

The entity is named `Campaign` rather than `Sheet`: "sheet" describes the UI (a tab),
not the domain. `Campaign` also fills the `Client → Campaign` slot that Phase 1
reserved.

## Scope

**In scope:** campaign CRUD, per-campaign property management (including formula
properties), records (days), value editing, computed values and a totals row.

**Out of scope:** authentication, multi-tenancy, CSV import, AI analysis, public
report links, frontend. A UI editor for building formulas is out of scope, but the
storage format is designed for it — the API already accepts arbitrary expression
trees, so enabling it later requires no schema change.

## Data model

Each campaign owns its own set of properties. Creating a campaign seeds the default
set; from then on the user may rename, delete, reorder or add properties in that
campaign without affecting others.

Postgres tables use snake_case (`campaign_property`, `campaign_record`,
`campaign_property_value`, and the pre-existing `client`); the Prisma models keep
PascalCase names and map to those tables with `@@map`/`@map`.

```prisma
model Campaign {
  id         String             @id @default(uuid())
  clientId   String             @map("client_id")
  client     Client             @relation(fields: [clientId], references: [id], onDelete: Cascade)
  name       String
  position   Int
  createdAt  DateTime           @default(now()) @map("created_at")
  updatedAt  DateTime           @updatedAt @map("updated_at")
  properties CampaignProperty[]
  records    CampaignRecord[]

  @@index([clientId, position])
  @@map("campaign")
}

enum PropertyType {
  NUMBER
  MONEY
  PERCENT
  TEXT

  @@map("property_type")
}

model CampaignProperty {
  id         String                  @id @default(uuid())
  campaignId String                  @map("campaign_id")
  campaign   Campaign                @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  name       String
  key        String?    // stable identifier of a seeded default property; null for custom ones
  type       PropertyType
  formula    Json?      // expression tree; null means the property is entered by hand
  position   Int
  values     CampaignPropertyValue[]

  @@index([campaignId, position])
  @@map("campaign_property")
}

model CampaignRecord {
  id         String                  @id @default(uuid())
  campaignId String                  @map("campaign_id")
  campaign   Campaign                @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  date       DateTime                @db.Date
  values     CampaignPropertyValue[]

  @@unique([campaignId, date])
  @@map("campaign_record")
}

/// One value typed in by the user, at the intersection of a record (day) and a property.
/// Exists only for properties without a formula — computed metrics are never stored here.
model CampaignPropertyValue {
  id          String           @id @default(uuid())
  recordId    String           @map("record_id")
  propertyId  String           @map("property_id")
  record      CampaignRecord   @relation(fields: [recordId], references: [id], onDelete: Cascade)
  property    CampaignProperty @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  numberValue Decimal?         @map("number_value") @db.Decimal(18, 4)
  textValue   String?          @map("text_value")

  @@unique([recordId, propertyId])
  @@map("campaign_property_value")
}
```

Notes:

- **`CampaignPropertyValue` is the storage for hand-entered data, and only for that.**
  The grid is the intersection of two dimensions the user controls independently —
  records/days (`CampaignRecord`) and properties/metrics (`CampaignProperty`) — so a
  value cannot live on either of them; it needs a record of its own, keyed by the
  pair. One row per filled cell: a day the user has not filled in yet simply has no
  values, which is why a fresh day renders as dashes rather than zeros.
- **A value exists only for properties without a formula.** Computed metrics are
  derived on read and never written here, so they cannot drift out of sync with their
  inputs; a `CampaignPropertyValue` pointing at a computed property would be
  unreachable data and is rejected by the API.
- **Two typed value fields, not one text field.** `numberValue` keeps `Decimal`
  semantics for arithmetic and sums; `textValue` holds comments. Exactly one of them
  is set, chosen by the property's `type`.
- **Money stays `Decimal`,** consistent with Phase 1: summing `float` loses precision.
- **`position`** is a dense integer sequence `0..n-1`. Inserting or moving a property
  or campaign renumbers the affected siblings inside one transaction.
- **Dates** are `@db.Date` (no time component) and unique per campaign: one day, one
  record.

### Default properties

Seeded on campaign creation, in this order. Names are canonical English; the frontend
localizes captions by `key`.

| position | key | name | type | formula |
|:--:|---|---|---|---|
| 0 | `spend` | SPEND | MONEY | — |
| 1 | `impressions` | IMPRESSIONS | NUMBER | — |
| 2 | `clicks` | CLICKS | NUMBER | — |
| 3 | `ctr` | CTR | PERCENT | `clicks / impressions * 100` |
| 4 | `cpm` | CPM | MONEY | `spend / impressions * 1000` |
| 5 | `cpc` | CPC | MONEY | `spend / clicks` |
| 6 | `leads` | LEADS | NUMBER | — |
| 7 | `cpl` | CPL | MONEY | `spend / leads` |
| 8 | `revenue` | REVENUE | MONEY | — |
| 9 | `roas` | ROAS | NUMBER | `revenue / spend` |
| 10 | `comment` | COMMENT | TEXT | — |

`REVENUE` is not on the original mockup but ROAS is meaningless without it: ROAS is
revenue divided by spend.

The date belongs to the record, not to a property — it cannot be deleted or reordered.

## Formulas

A formula is an expression tree stored as JSONB on the property. Three node kinds:

```ts
type Expression =
  | { kind: "binary"; op: "+" | "-" | "*" | "/"; left: Expression; right: Expression }
  | { kind: "property"; propertyId: string }
  | { kind: "const"; value: string };   // decimal literal as a string
```

`CTR` for example:

```json
{
  "kind": "binary", "op": "*",
  "left": {
    "kind": "binary", "op": "/",
    "left": { "kind": "property", "propertyId": "<clicks>" },
    "right": { "kind": "property", "propertyId": "<impressions>" }
  },
  "right": { "kind": "const", "value": "100" }
}
```

A tree, not a text formula language, means no parser and no lexer: the client sends
structure directly, and one recursive Zod schema validates both API input and stored
data.

**JSONB rather than an `ExpressionNode` table.** A tree is always read and written as
a whole together with its property; no query ever needs a single node, and no
aggregate ever runs over nodes. A node table would buy referential integrity on
`propertyId` at the cost of recursive assembly on read, recursive inserts on write,
and a sparse row shape (`op` for binary nodes, `value` for literals, `refPropertyId`
for references, the rest always NULL). Integrity is enforced in the service instead,
which is needed regardless: deleting a referenced property must produce a readable
message, not a foreign-key violation.

### Validation of a formula

On create and update the service checks that:

1. the tree matches the Zod schema;
2. every referenced property belongs to the same campaign;
3. the property does not reference itself;
4. the reference graph is acyclic (depth-first search over property references);
5. every referenced property is numeric — `TEXT` properties cannot appear in arithmetic.

A formula may reference another computed property; that is what makes the cycle check
necessary.

### Evaluation

Arithmetic uses `Prisma.Decimal`, already a transitive dependency — no new package.

- **Null propagates.** If any operand is null (empty value, or a null result from a
  nested expression), the result is null. An empty day therefore shows dashes in every
  derived property rather than zeros.
- **Division by zero yields null**, not an error. A day with zero impressions is
  ordinary data.
- Values are computed at full precision and rounded only on output, to 4 decimal
  places, and serialized as strings. Display formatting (`$`, `%`, decimal places) is
  the frontend's job — it knows the property `type`.

### Totals row

The totals resolver produces one value per property:

| property | total |
|---|---|
| entered `NUMBER` / `MONEY` | sum of non-null values |
| entered `PERCENT` | average of non-null values |
| `TEXT` | null |
| computed | the property's own formula evaluated over the totals of its operands |

Because a computed total re-runs the formula over sums, the CTR total comes out as
`Σ clicks / Σ impressions` — the traffic-weighted value — with no special-case code.
An empty campaign (no records) yields null totals for every property.

## API

Prefix `/api`. JSON in, JSON out.

| Method | Path | Description | Success |
|---|---|---|:--:|
| POST | `/clients/:clientId/campaigns` | create a campaign, seed default properties | 201 |
| GET | `/clients/:clientId/campaigns` | list campaigns of a client (no grid data) | 200 |
| GET | `/campaigns/:id` | full campaign: properties, records, totals | 200 |
| PATCH | `/campaigns/:id` | `name`, `position` | 200 |
| DELETE | `/campaigns/:id` | delete with all its content | 204 |
| POST | `/campaigns/:id/properties` | add a property | 201 |
| PATCH | `/properties/:id` | `name`, `type`, `formula`, `position` | 200 |
| DELETE | `/properties/:id` | delete a property and its values | 204 |
| POST | `/campaigns/:id/records` | add a day | 201 |
| PATCH | `/records/:id` | change the day's date | 200 |
| DELETE | `/records/:id` | delete a day | 204 |
| PUT | `/records/:recordId/values/:propertyId` | write a property value | 200 |

Value writes use `PUT` because they are idempotent: the frontend fires one on every
field blur, and a retry after a flaky connection must be harmless.

### Payloads

**Create campaign:** `{ "name": "Facebook — July" }`. `position` defaults to the end
of the client's list.

**Create property:** `{ "name": "...", "type": "NUMBER", "formula": null, "position": 3 }`.
`formula` and `position` are optional; a property without `position` is appended.

**Create record:** `{ "date": "2026-07-21" }`.

**Write value:** `{ "value": "1500.50" }` for numeric properties, `{ "value": "text" }`
for `TEXT`, `{ "value": null }` to clear (which deletes the `CampaignPropertyValue`
record). The response is the recomputed record plus the campaign totals —
`{ "record": { "id", "date", "values" }, "totals": { … } }` — because one entered
value changes several derived cells and the totals row, and the frontend would
otherwise have to refetch the campaign after every edit.

**`GET /campaigns/:id`:**

```json
{
  "id": "...",
  "clientId": "...",
  "name": "Facebook — July",
  "position": 0,
  "properties": [
    { "id": "p1", "key": "spend", "name": "SPEND", "type": "MONEY",
      "formula": null, "position": 0 }
  ],
  "records": [
    { "id": "r1", "date": "2026-07-21", "values": { "p1": "1500.0000", "p4": null } }
  ],
  "totals": { "p1": "1500.0000", "p4": null }
}
```

Entered and computed values share one `values` map keyed by property id, so the
frontend renders cells without caring where a number came from. Numbers are strings
to preserve decimal precision through JSON. Properties come back ordered by
`position`, records ascending by `date`.

`key` is assigned at seeding and never changes: renaming or reordering CTR keeps
`key: "ctr"`, so the frontend's caption lookup survives edits. Custom properties have
`key: null` and the API does not accept `key` from clients.

### Conflict rules

Some transitions would silently destroy data, so they are rejected instead:

- Adding a record, or moving an existing record's date, onto a date the campaign
  already has → 409.
- Deleting a property referenced by another property's formula → 409, naming the
  dependent property.
- Attaching a formula to a property that already has values → 409; the user must clear
  the property first. (Values of a computed property are unreachable, and dropping
  them implicitly would lose typed-in data.)
- Changing a property's type between `TEXT` and a numeric type while it has values →
  409. Changes among `NUMBER`, `MONEY` and `PERCENT` are always allowed: the stored
  representation is identical, only formatting differs.

## Error handling

The Phase 1 error middleware and JSON shape stay unchanged:

```json
{ "error": { "message": "...", "details": [ ... ] } }
```

| Situation | Code |
|---|:--:|
| Zod validation; write to a computed property; value type does not match the property; invalid or cyclic formula | 400 |
| Campaign, property or record not found | 404 |
| Conflict rules above | 409 |
| Internal error | 500 |

`ConflictError` sits in `src/errors.ts` alongside `NotFoundError`.

## Code structure

```
src/campaigns/   campaign.routes.ts, campaign.controller.ts,
                 campaign.service.ts, campaign.schema.ts, defaults.ts
src/properties/  property.routes.ts, property.controller.ts,
                 property.service.ts, property.schema.ts
src/records/     record.routes.ts, record.controller.ts, record.service.ts,
                 record.schema.ts,
                 value.controller.ts, value.service.ts, value.schema.ts
src/formula/     expression.schema.ts  // recursive Zod schema for the tree
                 evaluate.ts           // evaluator over Prisma.Decimal
                 dependencies.ts       // reference and cycle checks
                 table.ts              // assembles values + totals for a campaign
```

The layering of Phase 1 is preserved: routes → controller (Zod) → service (Prisma).

`src/formula/` knows nothing about Prisma or HTTP — it is pure functions over an
expression tree and a map of property values. It carries the densest logic in this
phase and must be testable without a database.

## Testing (TDD)

Each slice starts with a failing test.

- **formula (unit, no database):** nested expressions, null propagation, division by
  zero, references to computed properties, cycle detection, rejection of `TEXT`
  operands, totals derived from sums.
- **service:** default properties seeded on campaign creation, date uniqueness,
  refusal to delete a referenced property, position renumbering, clearing a value.
- **API (Supertest):** every endpoint plus the 400 / 404 / 409 paths.

Tests run against the separate `adpulse_test` database, one Postgres schema per test
worker so the suite stays parallel.

## Groundwork for later phases

- CSV import maps onto `POST records` + value writes; no schema change needed.
- A formula editor in the UI needs no backend change — the API already accepts
  arbitrary trees.
- Public report links will hang off `Campaign` as a share token.
