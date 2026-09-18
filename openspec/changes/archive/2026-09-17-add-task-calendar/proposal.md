## Why

The board answers what stage a task has reached, never when it is due: a task carries no
date at all. Planning by day — this Wednesday's call, Friday's deadline — therefore happens
outside AdPulse, and the recurring work an agency runs every week has nowhere to live.

## What Changes

- A task carries a due date: a day, optionally with a time of day. It stays optional, and a
  task without one behaves exactly as today.
- A task carries a checklist of items that are ticked off as the work proceeds.
- A task repeats on a chosen interval — every day, every week, every two weeks or every
  month. A repeating task offers **Выполнено**, which moves that same task to its next
  occurrence and clears its ticks, leaving the card where it sits on the board. No second
  task is created, so the history of past occurrences lives in the audit trail alone.
- The tasks screen offers two views of the same tasks, **Канбан** and **Календарь**, switched
  by a tab and faded into place. The chosen view is remembered for the member in their
  browser.
- The calendar shows one week at a time, columns Monday to Sunday, with navigation to the
  previous and next week and back to the current one. It shows only tasks that have a due
  date.
- Dragging a card onto another day in the calendar gives the task that day, keeping its time
  of day.

No requirement is removed and nothing existing is refused: this change is additive.

## Capabilities

### New Capabilities
- `task-calendar`: the week view of tasks by due date, the switch between the board and the
  calendar, and rescheduling a task by dragging its card onto another day.

### Modified Capabilities
- `task-board`: a task carries a due date, a checklist and a repetition interval, and
  completing a repeating task moves it to its next occurrence.

## Impact

- **API**: `Task` gains `due_date`, `due_time` and `repeat_every`; a new `task_checklist_item`
  table; one migration. New endpoints for checklist items and for completing a repeating
  task; `POST`/`PATCH /api/tasks` accept the new fields; `GET /api/tasks` accepts a due-date
  range. Task use cases, the Prisma task repository, the Zod schemas, the OpenAPI document,
  the audit trail and the realtime task events all follow.
- **Web**: `entities/task` gains the new fields and mutations; a new `widgets/task-calendar`;
  `TasksPage` gains the view tabs; `TaskFormDialog` gains the due date, checklist and
  repetition controls; `TaskCard` shows the due date; a `FadeContent` component joins
  `shared/ui`; new strings in `ru.ts`.
- **Dependencies**: none added. `motion`, `dnd-kit`, `date-fns` and `react-day-picker` are
  already in `apps/web`.
