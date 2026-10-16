## Why

Finishing a task means dragging its card across the board into Готово. On a wide board that is a
long drag, and in the calendar or a project's list of work in flight there is no column to drag
to at all. A repeating task can be completed in one click, but only from the calendar.

## What Changes

- Every task card — on the board, in the calendar and in a project's list of work in flight —
  carries a Готово checkbox for a member who may change tasks.
- Ticking it on a task that does not repeat moves the task to the top of Готово, as dragging it
  there would. Unticking it on a task in Готово moves the task to the top of В работе.
- Ticking it on a repeating task completes it into its next occurrence, as the calendar's
  completion control does today; the checkbox replaces that control.
- The checkbox is ticked exactly when the task is in Готово. Nobody who may not change tasks is
  offered it.

## Capabilities

### New Capabilities

### Modified Capabilities
- `task-board`: a task is closed and reopened from its card.

## Impact

- `apps/web/src/features/task-management/ui/TaskCardView.tsx`: the checkbox in place of the
  repeating task's completion button.
- `apps/web/src/widgets/task-board/`, `apps/web/src/widgets/task-calendar/`,
  `apps/web/src/widgets/task-list/`: wiring the checkbox to the existing move and complete
  mutations, with the same optimistic drawing and refusal handling as dragging.
- `apps/web/src/shared/config/ru.ts`: the checkbox's accessible name.
- No API change: closing and reopening use the existing move, completing uses the existing
  completion, both already audited and restricted to admins and managers.
