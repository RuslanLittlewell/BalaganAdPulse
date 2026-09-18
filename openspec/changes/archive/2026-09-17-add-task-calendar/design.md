## Context

`Task` carries no temporal field beyond `created_at`/`updated_at`, and the tasks module knows
one arrangement: `column` plus `position` inside it. `GET /api/tasks` returns every task the
actor reaches, filtered by project or campaign, and `TaskBoard` groups the answer in the
browser. Board moves already publish `task.*` events over the realtime channel and write an
audit row in the same transaction as the mutation.

Two properties of the existing board shape the design. First, the whole reachable board is
already fetched in one query and cached under a single React Query key, and `useTaskEvents`
keeps that cache fresh. Second, dnd-kit is wired with a droppable per column and a sortable
per card, and `resolveDrop`/`previewFor` compute the optimistic preview.

## Goals / Non-Goals

**Goals:**
- A due date that means the same calendar day for everyone reading it.
- A week view that reuses the board's cache and its realtime freshness rather than opening a
  second data path.
- Repetition that needs no scheduler, cron job or background worker.

**Non-Goals:**
- Time zones per member or per client: the agency reads one wall clock.
- Occurrence history — past repetitions live in the audit trail, as the proposal states.
- Notifications or reminders about a due date.
- Calendar export (iCal), month and day views, and multi-day tasks.

## Decisions

### The due date is a `date` column plus a separate time of day

`due_date DATE` (Prisma `DateTime @db.Date`) and `due_time` holding a `HH:MM` string,
with `repeat_every` as a new enum. The API carries them as `dueDate: "2026-09-25"` and
`dueTime: "12:00" | null`, formatted through the existing `formatDate` helper, exactly as the
campaign metric days are already carried.

A single `TIMESTAMPTZ` was rejected: a task "due on 25 September" with no time would have to
pick an instant, and every reader in another time zone would then see a different day — the
drift the spec forbids. Storing the time as `TIME` was rejected because Prisma hands it back
as a `Date` on 1970-01-01, which only invites the same mistake one layer up; a `HH:MM` string
is ordered lexicographically the same way it is ordered chronologically, and Zod validates it
with one regex.

`due_time` without `due_date` and a repeating task without `due_date` are both refused in the
use case and blocked by a `CHECK` constraint, so neither can arrive by another path.

### Repetition is a field on the task, not a series

`repeat_every` is `NONE | DAILY | WEEKLY | BIWEEKLY | MONTHLY`. Completing a repeating task
advances `due_date` by the interval from its own value — not from today — clears every
checklist tick, and leaves the task's column and position untouched. Date arithmetic lives
in the tasks domain as a pure function over `(date, interval)`, clamping to the last day of a
short month, and is tested without a database.

A generated series of occurrence rows was rejected: it needs a horizon, a job to extend it,
and a rule for edits that must reach the whole series. One row that walks forward carries no
such machinery, and the audit trail already records each step.

Completion says nothing about the column. A repeating task lives where its member put it —
a weekly call sits where that member keeps weekly calls — and the board's order is arranged
by hand, so tearing the card out and dropping it at the end of `IDEA` would undo an
arrangement the member made on purpose. Completion moves the task in time; the board is
moved by dragging, as it always was.

### Completion is its own endpoint

`POST /api/tasks/:id/complete`, beside the existing `/move`. Completion changes the due date
and rewrites every checklist row at once, and is refused for a non-repeating task;
expressing that through `PATCH` would mean a request that looks like an edit of one field
but rewrites child rows. The endpoint publishes `task.updated`, so every open board and calendar follows
without a new event kind.

### Checklist items are their own resource under the task

`task_checklist_item` (`id`, `task_id`, `title`, `done`, `position`) with
`ON DELETE CASCADE`, reached through `POST /api/tasks/:id/checklist`,
`PATCH /api/tasks/:id/checklist/:itemId`, `DELETE /api/tasks/:id/checklist/:itemId` and
`POST /api/tasks/:id/checklist/reorder`. Items ride on `TaskRecord` as
`checklist: { id, title, done, position }[]`, so a board fetch needs no second round trip and
the existing `task.updated` event carries their state.

Permission and reach are the task's own: every checklist call resolves the task through
`findReachable` first, so an unreachable task answers 404 before the item is looked at, and
`can(actor, "update", "task")` gates the write. No new resource joins the access matrix.

### The calendar filters the cached board rather than querying a week

The week view reads the same `useTasks()` cache the board reads and keeps the tasks whose
`dueDate` falls in the shown week. Switching tabs therefore costs no request, realtime
updates arrive through `useTaskEvents` unchanged, and a task dragged to another day needs no
refetch.

`GET /api/tasks` still gains `dueFrom`/`dueTo` query parameters, because the OpenAPI contract
should express the filter and a large organization will eventually want it, but the web app
does not pass them yet. Fetching per week was rejected for now: it would fragment the cache
by week, duplicate the realtime invalidation logic, and buy nothing at the size of board the
product has.

### Dragging in the calendar reuses the board's dnd-kit setup

A day column is a droppable whose id is the day, and dropping sends `PATCH /api/tasks/:id`
with the new `dueDate` — not `/move`, which is about columns. The optimistic update writes
the new `dueDate` into the React Query cache and rolls it back on failure, mirroring how
`useMoveTask` already behaves. Ordering inside a day is derived (time first, then the board's
`position`), so nothing needs to be persisted for it.

### FadeContent is a local component

A small `shared/ui/FadeContent` built on `motion` — the reactbits component is a
copy-into-your-project snippet, and `motion` is already a dependency. Per the repository's
testing rule the tests assert which view is rendered, never the opacity or the transition.

## Risks / Trade-offs

- [A member whose machine runs another time zone reads "today" differently from the server] →
  The due date is a plain day with no instant behind it, and "today" for the calendar's
  marker and its opening week is computed from the browser's local day; nothing converts
  between the two.
- [Holding the whole board in the cache does not scale forever] → `dueFrom`/`dueTo` land in
  the API with this change, so switching the calendar to a windowed query later is a web-side
  change with no migration.
- [Completing a repeating task loses the record of the occurrence just closed] → Accepted and
  stated in the spec; the audit event names the member, the task and both dates.
- [A repeating task completed from `DONE` or `ARCHIVED` stays there with a future due date] →
  Completion never moves a card, by design; a member who parked a repeating task in a
  terminal column drags it back when they want it in play, as they would any other card.
- [A monthly task pinned to the 31st drifts to the 28th and stays there] → Clamping is
  applied to the stored date; a member who wants the month end back sets it once. Anchoring
  to the original day of month was rejected as more state than this earns.

## Migration Plan

One migration, additive, with no data loss and nothing to backfill:

1. `ALTER TABLE "task"` adds `due_date DATE NULL`, `due_time VARCHAR(5) NULL` and
   `repeat_every "task_repeat" NOT NULL DEFAULT 'NONE'`, after creating the
   `task_repeat` enum.
2. A `CHECK` constraint: `due_time` is null unless `due_date` is set, and `repeat_every` is
   `'NONE'` unless `due_date` is set.
3. `CREATE TABLE "task_checklist_item"` with `task_id` referencing `task(id)`
   `ON DELETE CASCADE`, and an index on `(task_id, position)`.
4. An index on `(org_id, due_date)` for the range filter.

Every existing task keeps its column, position and fields, gains a null due date, no
repetition and an empty checklist, and behaves exactly as before. Rolling back means dropping
the three columns, the constraint, the index and the table; no existing column is altered or
dropped, so a rollback loses only data entered through this change.
