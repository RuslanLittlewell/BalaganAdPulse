## Context

Customers already raise tasks on their projects; such a task is `visibleToClient` and must
have a project. Admins reach every task of the organization; managers reach tasks with no
project only when they wrote them or take part. Editing is decided by the shared permission
matrix, which gives customers `create` on tasks and nothing else.

## Goals / Non-Goals

**Goals:**
- A customer keeps personal tasks without a project, seen and managed by them alone.

**Non-Goals:**
- Personal tasks for agency staff; theirs already exist and admins see them.
- Moving a personal task into a project, or sharing it with the client's colleagues.

## Decisions

### A stored `personal` flag

`task.personal` is set when a customer creates a task with no project, and never changes.
Deriving it from the author's role at read time was rejected: every filter — the board,
realtime delivery, notifications, audit — would need the author's membership, and a later
role change would silently expose or hide tasks.

### Reach

- Admin: the organization's tasks with `personal = false`.
- Customer: tasks marked visible on reached projects, or `personal = true` and written by
  them.
- Manager and guest: unchanged; a personal task has no participants and a customer author,
  so it never matches.

Realtime delivery applies the same rule to the event's task, so the `task.deleted` event
carries `personal` too.

### Editing

The matrix stays as it is, since it answers per role, not per row. The use cases allow an
update, move, completion or deletion when the matrix permits it, or when the task is
personal and the actor wrote it. A personal task refuses a project (400), and keeps refusing
participants and visibility changes from a customer as before.

The web app decides per task: `mayChange(task) = can("update", "task") || task.personal`.
A customer only ever receives their own personal tasks, so `personal` alone means "mine".

### One form for clients

Customers used to open a task in the compact preview guests get. They now get the task form
in a read-only mode whenever they may not change the task: the title is read-only, the stage
and priority selects and every block are disabled through a `fieldset`, the add and remove
controls, the description's edit toggle, attachment removal, Сохранить and Удалить are
absent, and Отмена reads Закрыть. Comments stay outside the disabled parts. Guests keep the
preview. Read-only mode waits for the role to be known, so the form never flashes disabled
while the session loads.

### No audit events

Audit history is read by admins across the organization, so a personal task's events
would expose its title. They are skipped.

### Notifications

The due-soon notice goes to participants or, with none, to the author; customers are
filtered out unless the task is visible to the client. Personal tasks are let through as
well, so the author is reminded.

## Risks / Trade-offs

- [An admin cannot see or clean up a customer's personal tasks] → That is the request.
  Deleting the customer's membership or client removes them with it.
- [No audit trail for personal tasks] → They concern nobody but their author.
