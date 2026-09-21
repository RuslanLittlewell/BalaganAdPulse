## 1. Storage gains an anchor for each custom column

- [x] 1.1 Add `afterStage LeadStage? @map("after_stage")` to `LeadColumn` in `schema.prisma`
  and write the migration that adds the column and backfills every existing row to
  `'PROPOSAL'`.
- [x] 1.2 Write and observe a failing isolated migration test (matching
  `client-reach.migration.test.ts`'s and `lead.reorder.migration.test.ts`'s pattern): a scratch
  `lead_column` table seeded with rows that have no `after_stage`, asserting the migration
  backfills `'PROPOSAL'` for all of them and touches no other column.
- [x] 1.3 Run `npm test` until green.

## 2. A column's board position spans fixed stages and custom columns together

- [x] 2.1 Write and observe failing API tests: moving a column to index 0 places it before
  `NEW`; moving it to an index that lands between two fixed stages places it there and a board
  read reflects the new interleaved order; moving among customs only (unchanged from before)
  still works; a fixed stage still refuses rename, move and delete with 400. Update the
  existing "moves a column among the custom columns and keeps the fixed stages first" test's
  sent `position` values to the new full-board indexing they now require.
- [x] 2.2 Add `afterStage` to `LeadColumnRecord`, rewrite `boardColumns()` to group customs by
  anchor around the fixed four, and update `customColumnOf` if needed.
- [x] 2.3 Add `afterStage` to the `createColumn`/`updateColumn` ports and to
  `PrismaLeadRepository`'s pass-through calls.
- [x] 2.4 In `lead-use-cases.ts`: default `createColumn` to anchor `PROPOSAL` (the current
  behaviour); rewrite `updateColumn`'s reposition branch to splice the moving column into
  `boardColumns()`'s full merged array at the requested index and derive every custom column's
  `(afterStage, position)` from a left-to-right walk of the result, writing only changed rows;
  scope `deleteColumn`'s post-delete reindex to the deleted column's own anchor group instead
  of the whole board.
- [x] 2.5 Run `npm test` until green.

## 3. The move-left/move-right controls reach across fixed stages

- [x] 3.1 Write and observe failing web tests updating `CrmColumns.test.tsx`'s
  "moves a column one place left or right among the custom columns" scenario to the new
  full-board indexing (move-left no longer disabled just for being first among customs; the
  sent `position` reflects the column's index in the full board list), and add a scenario
  moving a column left until it sits before the first fixed stage.
- [x] 3.2 Change `LeadColumnMenu`'s `index` lookup from a customs-only filter to
  `columns.findIndex(...)` against the full `columns` prop it already receives.
- [x] 3.3 Run `npm run test:web` until green.

## 4. Lead cards carry their column's accent colour

- [x] 4.1 Extract `CrmColumn.tsx`'s `ACCENT` record into `widgets/crm-board/accent.ts` as
  `accentOf(stageOrColumnId)`, returning the dot's background class and a matching border
  class as literal Tailwind strings, keyed the same way (`isLeadStage` fixed lookup, one
  fallback for custom columns).
- [x] 4.2 Use `accentOf(...).dot` in `CrmColumn.tsx` in place of the inline `ACCENT` lookup,
  and `accentOf(lead.stage).border` in `LeadCard.tsx`'s card border, removing the redundant
  `hover:border-border` that would otherwise reset the colour on hover.
- [x] 4.3 Run `npm run test:web` to confirm no behavioural test asserts on the removed inline
  `ACCENT` record (styling itself stays untested, per this repo's conventions).

## 5. Close the change

- [x] 5.1 Run `openspec validate let-crm-columns-interleave-with-fixed-stages --strict` and
  confirm the implementation matches every scenario in the delta spec.
- [x] 5.2 Run the full `npm test` and `npm run test:web` one more time from a clean state.
