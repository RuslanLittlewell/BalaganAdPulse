## Context

A task's column is a Postgres enum, `task_column`, mirrored by `TASK_COLUMNS` in the API and in
the web app. Every column change goes through `applyOrder`, which already stamps `archivedAt` on
tasks entering `ARCHIVED` and clears it elsewhere. Shelving after seven days is computed in the
browser from `archivedAt`. The API already runs interval workers, such as the due-soon
reminders, started and stopped by `server.ts`.

## Goals / Non-Goals

**Goals:**
- Day-old done tasks leave Готово without anybody acting, and open boards see it happen.
- An admin can send a done task to the archive in one click.

**Non-Goals:**
- Restricting who may drag a task into the archive. Managers keep that; the approval is a
  shortcut for admins, not a new permission.
- A separate "approved" state or flag on a task.
- Changing the seven-day shelving rule.

## Decisions

- **`QUEUED` enum value, added after `IDEA`.** `ALTER TYPE ... ADD VALUE 'QUEUED' AFTER 'IDEA'`
  keeps the enum's sort order matching the board, which the task list's `ORDER BY column`
  relies on. The web app's `TASK_COLUMNS` already orders the board and gets the value in the
  same place.
- **`done_at` column, stamped by `applyOrder`.** It mirrors `archivedAt`: set on tasks entering
  `DONE` that have none, cleared in any other column, set on a task created straight into
  `DONE`. `updatedAt` cannot serve, because reordering a column rewrites it. The migration
  stamps existing done tasks with the migration time, so nothing is archived the moment the
  release is deployed. The API does not return `doneAt`; nothing in the interface reads it.
- **A worker in the API, not a rule in the browser.** Unlike shelving, the move has to be real:
  the task must enter `ARCHIVED` and get its `archivedAt` for the seven-day rule to start, and
  the due-soon reminders already treat `DONE` and `ARCHIVED` tasks by their stored column. The
  worker runs every five minutes, asks for tasks whose `done_at` is 24 hours old, and moves each
  in its own transaction: close the gap in `DONE`, place the task first in `ARCHIVED`.
- **The automatic move writes no audit event and sends no notification.** The audit writer needs
  a member to name and there is none. The task event is still published, so boards update.
- **Approval is the existing move endpoint.** The В архив control on a done card sends
  `{ column: "ARCHIVED", position: 0 }` through the same mutation a drag uses. The audit log
  then records the admin and the move with no new endpoint. Only the web app decides who sees
  the control, by the member's role.

## Risks / Trade-offs

- [A task is reopened in the instant between the worker's query and its move] → The worker
  moves only tasks that are still in `DONE` with the same `done_at` when its transaction runs.
- [Two API instances run the worker at once] → The same guard makes the second move a no-op.
- [`ADD VALUE` inside a migration transaction] → Postgres 12 and later allow it as long as the
  value is not used in the same transaction; the migration does not use it.

## Migration Plan

Deploy runs `prisma migrate deploy`. Rolling back the image leaves `QUEUED` and `done_at` in the
database. The old Prisma client does not know `QUEUED` and fails to read a task that holds it,
so move queued tasks to another column before rolling back.
