## Why

A task's stage can be changed only by dragging its card across the board. A member who has the
task open in its form — from the board, the calendar or a project — sees its priority in the
dialog's header but not its stage, and has to close the form and find the card to move it.

## What Changes

- The task form's header offers Этап next to Приоритет: a select showing the task's current
  stage and listing all six stages in the board's order.
- Choosing another stage and saving moves the task to the top of that stage, as a move that obeys
  every rule a dragged move does. Saving without changing it leaves the task where it is, and
  closing without saving changes nothing.
- A new task shows the stage it will be created in — the column the form was opened from, or
  Идея — and is created in the stage chosen.
- Only a member who may change tasks is offered the select.

## Capabilities

### New Capabilities

### Modified Capabilities
- `task-board`: the task form shows and changes the task's stage.

## Impact

- `apps/web/src/features/task-management/ui/TaskFormDialog.tsx`: the Этап select in the header;
  on save, a changed stage is applied through the existing move before the other fields are
  updated.
- `apps/web/src/shared/config/ru.ts`: the select's label.
- No API change: creation already accepts a column, and moving uses the existing move.
