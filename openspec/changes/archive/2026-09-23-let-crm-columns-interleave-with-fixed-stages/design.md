## Context

See `proposal.md` - Why. Relevant existing machinery:

- `boardColumns(custom)` (`domain/lead.ts`) currently builds the board's column list as
  `[...fixed four, ...custom.map(customColumnOf)]` — custom columns always trail the fixed
  four, ordered by their own dense `position` (0..n-1 among customs only).
- `updateColumn`'s reposition path (`lead-use-cases.ts`) splices the moving column into the
  customs-only array at the requested index and reindexes with `orderedColumns()`, the same
  "recompute the whole array, write only the rows whose index changed" helper `move()` (for
  leads) and `create()` (since the earlier newest-first change) already use.
- `LeadColumnMenu` (web) computes its move-left/move-right target from `custom.findIndex(...)`
  against a customs-only slice of the `columns` prop it already receives — that prop is
  already the full `boardColumns()` result (fixed and custom together); only the slicing needs
  to change.
- The `/leads` list endpoint orders rows by `{stage: nulls last}, {column: {position: asc}},
  {position: asc}` — a SQL-level ordering that assumes every custom-column lead trails every
  fixed-stage lead. Nothing in the product reads this row order for layout: `CrmBoard.tsx`
  re-buckets the returned leads by `lead.stage`/`lead.columnId` into a `Map` keyed by column
  id, using the separately-fetched `columns` array (not the leads response's row order) to
  decide where each bucket is drawn.

## Goals / Non-Goals

- Goal: a custom column can be moved to any of the board's positions — before `NEW`, between
  any two fixed stages, between two custom columns, or after everything — through the same
  move-left/move-right controls that already exist, with no new UI.
- Goal: the fixed four keep their own relative order and every other rule about them (cannot
  be renamed, moved relative to each other, or deleted) exactly as specified.
- Goal: every existing board's visible order is unchanged the moment this ships — the
  migration is purely a storage-shape change, not a data change a member would notice.
- Non-goal: reordering fixed stages relative to each other, or letting a custom column be
  renamed into occupying a "between" position implicitly by any means other than the existing
  move controls.
- Non-goal: making the `/leads` endpoint's row order match the interleaved board order. It
  already doesn't drive layout (see Context), and teaching a Prisma `orderBy` to rank rows by
  an interleaved, per-column anchor would need a raw, hand-maintained SQL expression for a
  property nothing reads. Left as its current, simpler "fixed stages, then every custom column
  by its own position" order — see Risks / Trade-offs.

## Decisions

**A column's anchor is which fixed stage it immediately follows, not a numeric offset.**
`LeadColumn` gains `afterStage: LeadStage | null` (`null` = before `NEW`, the start of the
board). Combined with the existing per-column `position` (now dense **within its anchor's
group**, not across the whole board), this gives five groups — before `NEW`, after `NEW`,
after `QUALIFIED`, after `TARGET`, after `PROPOSAL` — each independently densely ordered,
exactly the same dense-reindex-on-every-write style `position` already uses for leads and for
columns today. An alternative considered: a single float/fractional position spanning the
whole board (no anchor field), which would avoid a schema change but trade the repo's existing
"always dense integers, always fully reindexed" convention for a fractional-indexing scheme
this codebase does not otherwise use, and would need its own gap-exhaustion handling.

**`updateColumn`'s `position` input keeps its shape, changes its meaning.** The request body
stays `{name?, position?}` — no new field on the wire. Server-side, `position` is now read as
"target index in `boardColumns()`'s full merged array" instead of "target index among customs
only." The use case builds that full array, splices the moving column to the requested index
(clamped to the array's bounds, same as today), and derives every custom column's
`(afterStage, position)` from a single left-to-right walk of the result — writing a row only
when its computed anchor or position actually changed, mirroring `ordered()`'s existing
change-diffing. This is a breaking change to that one field's meaning, called out in
`proposal.md`, but keeps the request/response shapes stable, so no `LeadColumnInput` schema
change, no OpenAPI shape change and no frontend payload change beyond what index `Left`/`Right`
compute.

**The web move-left/move-right controls index against the full column list, unchanged
otherwise.** `LeadColumnMenu` already receives `columns` (the full `boardColumns()` result) as
a prop; only its internal `index` lookup changes from filtering to `kind === 'CUSTOM'` first to
using `columns.findIndex(...)` directly. Disabled state ("already first" / "already last")
naturally now means "first or last of the whole board," which is exactly what lets a column
step across a fixed stage on the next click — no new control, icon or interaction is added.

**Card border colour is read from the same lookup the column header dot already uses,
extracted once.** `CrmColumn.tsx`'s `ACCENT` record moves to a small shared
`widgets/crm-board/accent.ts` (`accentOf(stageOrColumnId)`, returning both the dot's background
class and a matching border class, as literal Tailwind class strings — dynamic class-name
construction is avoided the same way the existing `ACCENT`/`PRIORITY_BAR` records already
avoid it). `LeadCard` uses the border half; `CrmColumn` keeps using the dot half. Since
`CrmCalendar` already renders `LeadCard` (added in the previous change), its cards pick up the
same accent border with no further change there.

## Risks / Trade-offs

- [Risk] `/leads`' row order no longer corresponds to the board's visible order once a column
  is interleaved (a custom column anchored after `NEW` still lists its leads after every
  fixed-stage lead in the raw response, not right after `NEW`'s). → Mitigation: nothing in the
  product reads that row order for layout (see Context and the Non-Goal above); this is an
  existing, now slightly more visible, property of an endpoint whose ordering was never a
  documented contract (no spec requirement commits to it), not a regression in anything a
  member can observe.
- [Risk] `repositionColumns` (the use case's full-board walk) issues one `UPDATE` per custom
  column whose anchor or position changed by the move, same cost shape as `move()` already
  pays for leads. → Mitigation: boards are capped at 20 custom columns (existing limit), so
  the walk and its writes are bounded and small.
- [Trade-off] Existing web and API tests that assert a specific `position` value sent to
  `PATCH .../columns/:id` (or a specific move-left/move-right outcome) encode the old
  customs-only indexing and must be rewritten against the new full-board indexing; this is the
  direct, expected consequence of the breaking field-meaning change and is called out in
  `tasks.md`.

## Migration Plan

1. Add `afterStage LeadStage? @map("after_stage")` to `LeadColumn` and a migration that
   backfills every existing row to `'PROPOSAL'` (the last fixed stage) — this reproduces every
   board's current "all customs after all fixed stages, in their existing order" exactly, so no
   deploy-time visible change. Forward-only, same as the other migrations in this repository;
   rollback means restoring from backup, as usual here.
2. Ship the domain (`boardColumns`, `LeadColumnRecord`), application (`createColumn`,
   `updateColumn`, `deleteColumn`'s slot-scoped reindex) and repository changes together — the
   API's observable behaviour for existing customs-only moves is unchanged by these; only
   moves that request an index landing among the fixed stages behave newly.
3. Ship the web `LeadColumnMenu` indexing change and the `LeadCard`/`CrmColumn` shared accent
   extraction in the same or a later release; neither depends on the others beyond the API
   already being deployed.
