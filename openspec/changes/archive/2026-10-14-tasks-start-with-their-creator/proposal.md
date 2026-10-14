## Why

A manager or guest who creates a task on a project without naming anybody responsible
loses it the moment it is saved: the board shows them only the project tasks they are
responsible for, and nobody is. The work they just wrote down is visible to admins alone.
The form also opens with nobody responsible, so leaving the field untouched is the
common way to fall into this.

## What Changes

- A `MANAGER` or `GUEST` sees a project task nobody is responsible for when they created
  it, on the board, in the project's task list, by its address and through live board
  updates. Once somebody is made responsible, the task follows the existing rule and is
  seen by that member.
- The task form, when creating a task, names the member filling it in as responsible
  from the start whenever they can be picked, so the `Назначить` block opens with them
  chosen. They can still pick somebody else or clear the field.
- A task created through the API without naming anybody responsible is still stored
  with nobody responsible; the default lives in the form.

## Capabilities

### New Capabilities

### Modified Capabilities
- `task-board`: who sees a project task nobody is responsible for, and what the task
  form starts with.

## Impact

- `apps/api/src/modules/tasks/infrastructure/prisma-task-repository.ts`: the visibility
  rule for staff.
- `apps/api/src/modules/realtime/application/task-event-delivery.ts`: the same rule for
  live board updates.
- `apps/web/src/features/task-management/ui/TaskFormDialog.tsx`: the responsible member
  a new task starts with.
- No schema change, no new endpoint.
