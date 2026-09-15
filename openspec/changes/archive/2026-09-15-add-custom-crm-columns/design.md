## Context

- `lead.stage` is the Postgres enum `lead_stage` with eight values. The leads module orders a board by `(stage, position)` and serializes mutations with a per-board advisory lock.
- Moves send `{ stage, position }`. Realtime publishes `crm.changed` per board.
- The web board renders `LEAD_STAGES` as fixed columns with dnd-kit droppables keyed by stage. The lead form offers the same list.
- Meta intake appends leads to `NEW`.

## Goals / Non-Goals

**Goals:** four fixed stages, per-board custom columns with rename, reorder and delete, lossless migration, one move path for fixed and custom columns.

**Non-Goals:**
- column colours;
- dragging columns;
- WIP limits;
- moving leads or columns across boards;
- per-column automation.

## Decisions

### A lead is in exactly one of a fixed stage or a custom column

Rebuild `lead_stage` with `NEW`, `QUALIFIED`, `TARGET` and `PROPOSAL`, and make `lead.stage` nullable. Add `lead_column`:
- `id`, `org_id`, nullable `client_id` identifying the board;
- `name varchar(50)`, `position`, `created_at`, `updated_at`;
- cascading with its organization and client;
- a unique index on `(org_id, coalesce(client_id, ''), lower(name))`.

Add `lead.column_id` referencing `lead_column` with `ON DELETE NO ACTION`, and the check `(stage IS NULL) <> (column_id IS NULL)`. `NO ACTION` still refuses deleting a column that holds leads, but checks at the end of the statement, so deleting a client removes its leads and columns together; `RESTRICT` would refuse that cascade.

Seeding fixed stages as rows per board was rejected: boards are implicit (one per organization and client), so every client creation would need seeding, and fixed stages would need guards against renames anyway.

### The API keeps one `stage` string

Lead responses and inputs carry `stage` as either a fixed key or a custom column id. The repository maps it to `stage` or `column_id`, and the use cases validate it against the fixed keys and the board's columns. Board ordering becomes:
1. fixed stages in enum order;
2. then custom columns by position;
3. then lead position within each.

`GET /api/crm/boards/:board/columns` returns the fixed stages (`kind: "FIXED"`, id is the key, name from the server-side Russian label) followed by custom columns (`kind: "CUSTOM"`). Column writes live on the same resource: `POST`, `PATCH` with `{ name?, position? }` and `DELETE`. They take the board lock, reuse the lead permissions and audit with `entityType: "lead-column"`.

A separate `columnId` field was rejected: every consumer would have to reconcile two fields for one placement.

### Deleting a column moves its leads to the end of Новый

In one transaction under the board lock:
1. append the column's leads to `NEW` in their current order;
2. delete the column;
3. close the column position gap.

The UI states the lead count before confirming.

### Reordering by one step

`PATCH` accepts a `position` within the board's custom columns. The UI offers Сдвинуть влево and Сдвинуть вправо in the column menu. This keeps reordering accessible and avoids a second drag layer beside card dragging.

### Web board

`useLeadColumns(board)` feeds `CrmBoard`, which renders fixed and custom columns with droppable ids equal to their stage values, then the placeholder when the board allows management.
- A shared `ColumnNameDialog` creates and renames columns.
- The column menu (⋯) offers rename, move and delete, and appears on custom columns only.
- Ordering helpers use the column list order instead of `LEAD_STAGES`.
- Russian labels for fixed stages live in `ru.ts`.

## Risks / Trade-offs

- [Removed stages lose meaning such as Выигран or Проигран] → Accepted by the product decision to move them to Новый; boards can recreate such columns.
- [Enum rebuild requires rewriting rows] → Done in one migration with a temporary type; verified on a populated copy.
- [A lead moved into a column deleted concurrently] → The board lock serializes column deletion and moves; the loser gets 400 for an unknown column.

## Migration Plan

1. Create `lead_column`.
2. Renumber positions so that leads in `CONTACTED`, `NEGOTIATION`, `WON`, `LOST` and `DEFERRED` follow the existing `NEW` leads of their board in stage order then position, and set their stage to `NEW`.
3. Rename `lead_stage` to `lead_stage_old`, create the new `lead_stage` with four values, and convert the `stage` column. Drop the old type.
4. Add `lead.column_id` with its foreign key, index and check.

Every lead survives. Verify on a copy of the populated development database: lead counts per board are unchanged, and positions are contiguous per stage. Rollback needs a reverse migration; removed stages cannot be restored from data.
