## Context

See `proposal.md` - Why. Two pieces of existing machinery this change builds on:

- **Ordering.** `Lead.position` is already a per-`(orgId, clientId, stage-or-columnId)` dense
  ordering, maintained by reading the board's rows, splicing the moved/created row into the
  desired index, and writing back only the rows whose index changed
  (`lead-use-cases.ts`'s `ordered()` helper, used by `move()`). `LeadRecord.stage` already
  normalizes a fixed stage and a custom column's id into one string
  (`prisma-lead-repository.ts`'s `toLeadRecord`), so grouping only ever needs that one field.
- **Arrival.** "When a lead arrived" is already a defined domain concept: the CRM's period
  lead counts requirement arrives a Meta lead at `metaSource.submittedAt` and any other lead
  at `createdAt`, as UTC calendar days (`domain/lead.ts`'s `arrivalWindow`). The calendar
  reuses this, not a new concept.
- **Week navigation.** `widgets/task-calendar/week.ts` already implements Monday-start week
  math and Russian day/month labels, independent of tasks. `widgets/task-calendar/CalendarDay.tsx`
  already imports `TaskCard` straight from `@/widgets/task-board/TaskCard.js`, so a same-layer
  widget-to-widget import for a presentational card is the codebase's existing pattern, not a
  new one.

## Goals / Non-Goals

- Goal: newest-first ordering for every path that adds a lead to a stage/column — manual
  creation and Meta import alike — with no divergence between them.
  Meta batches most often introduce one new lead, but a batch is
  treated as one insertion: it is prepended as a whole, in delivery order, without asking the
  order to also reflect microsecond submission times.
- Goal: the calendar reuses `LeadCard` and the board's own `useLeads(boardKey)` query, so it
  needs no new API endpoint and stays in sync with the board through the same React Query
  cache and the same `useCrmEvents` realtime subscription already running at `CrmPage`.
- Non-goal: the calendar does not add drag-to-reschedule. A lead's arrival date is a fact
  about the past, not a plan; the calendar is read-only navigation, not editing.
- Non-goal: no change to manual drag ordering within a board (`move()`), to column
  management, or to `deleteColumn`'s existing "leads land at the end of Новый" behavior — that
  rule is about where displaced leads go, not about how new leads arrive, and is left as
  specified.

## Decisions

**Prepend by reusing `ordered()`, not a bulk `position + 1` update.** `create()` writes the
new row with a placeholder position, then calls the existing `ordered(context, [newRow,
...existingRowsOfThatStage])` — the same per-row-diff helper `move()` already uses. This
keeps one code path responsible for "make this exact array the position order" instead of
introducing a second, bulk-SQL shifting strategy alongside it. Cost: one `UPDATE` per
existing lead in that stage/column, same as a `move()` into position 0 already costs today —
acceptable, since a stage/column rarely holds more than a few dozen leads.

**Meta intake shifts with a single bulk `UPDATE`, not a per-row loop.** `deliver()` already
locks the board and knows the count of `NEW` leads; it does not otherwise load the full lead
list. Loading every `NEW` lead just to reuse `ordered()` would add a query the intake path
doesn't currently make. Instead, a new `LeadIntakeRepository.shiftNew(context, orgId,
clientId, by)` runs one `UPDATE lead SET position = position + $by WHERE ... AND stage =
'NEW'`, then claimed leads are created at positions `0..n-1`. `countNew` is removed in favor
of this, since nothing else calls it.

**The migration is one raw SQL file, not an app-level backfill script.** The reorder is a
pure function of already-stored `created_at` values, expressible as one `UPDATE ... FROM
(SELECT id, ROW_NUMBER() OVER (PARTITION BY org_id, client_id, COALESCE(stage::text,
column_id) ORDER BY created_at DESC, id) - 1 AS position FROM lead) ranked WHERE lead.id =
ranked.id`. Running it as a migration means it happens exactly once, in the same place every
other schema change already happens, with no extra deploy step and no risk of an operator
forgetting to run a script. It writes no audit event: this is a one-time storage-level
renumbering of an already-existing field, not a member action.

**The calendar is its own capability spec (`lead-calendar`), not a delta to `lead-crm`'s
"CRM uses the task board visual language" requirement.** This mirrors the existing precedent:
`task-calendar` is a sibling spec to `task-board`, not a modification of it, because it
describes a second, independently-testable view of the same records rather than changing the
board's own behavior.

**`CrmCalendar` fetches its own `useLeads(boardKey)`** rather than `CrmPage` lifting the
query and passing `leads` down to both views as props (the pattern `TasksPage` uses for
`TaskBoard`/`TaskCalendar`). `CrmBoard` already fetches its own leads and columns internally
— unlike `TaskBoard` — so matching `CrmBoard`'s existing within-module convention avoids
reshaping it just to introduce the calendar. React Query dedupes both views' identical
`leadsKey(boardKey)` query against one cache entry, so this costs no extra request.

**View choice remembered per person only, not per person per board.** Matches
`taskViews`'s shape exactly (`ByUser`, no board dimension) on the reasoning that a person's
preference for scanning by column versus by day is a habit, not a per-client decision.

## Risks / Trade-offs

- [Risk] The migration renumbers every lead in the database in one statement; on a very large
  table this could hold locks longer than a typical migration. → Mitigation: the CRM's own
  spec already bounds boards to modest sizes in practice (custom columns are capped at 20, and
  this is an internal agency tool, not a high-volume consumer CRM); a single `UPDATE` with a
  window function over the `lead` table is expected to be fast at this scale, and the
  migration runs inside the same `prisma migrate deploy` step every release already performs
  with no live traffic assumption beyond what other migrations already make.
- [Risk] Prepending on every create/import means a busy board's earlier leads keep shifting
  position server-side, one `UPDATE` per lead already in that stage/column. → Mitigation: this
  is the same per-row cost `move()` already pays for a drop at position 0; boards are
  small enough (a marketing agency's funnels, not a call center's) that this is not a
  new performance concern.
- [Trade-off] A lead's `position` field now means two different things depending on how you
  read it — "manually chosen order" after a drag, or "reverse chronological" for whatever no
  one has dragged yet — with no field distinguishing the two. → Accepted: this is exactly
  how `position` already behaves for tasks and for the existing board (`move()` already lets
  a manual drag override the append/prepend default), so no new inconsistency is introduced.

## Migration Plan

1. Add the `Lead.create`/`ordered()` prepend change and the intake `shiftNew` change
   (application-layer only, no schema change) — deploys independently of the data migration
   and is safe to ship first.
2. Add the Prisma migration that renumbers existing `lead.position` values. Forward-only: it
   only reassigns an existing integer column, so `prisma migrate deploy` applies it like any
   other migration. There is no down-migration; rolling back would mean restoring the old
   `position` values from a backup, the same as for any other migration in this repo.
3. Ship the web `crm-calendar` widget and `CrmPage` tabs; this has no dependency on the
   migration having run (the calendar reads `createdAt`/`metaSource.submittedAt`, not
   `position`) and can ship in the same release or a later one.
