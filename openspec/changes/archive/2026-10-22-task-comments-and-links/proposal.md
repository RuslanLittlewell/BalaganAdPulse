## Why

A task has no place for discussion: questions and answers go to the description or to
messengers, and nobody is told when they are asked something. Also, an opened task leaves the
address bar unchanged, so it cannot be copied and sent to a colleague.

## What Changes

- The task dialog gets a «Комментарии» section under the description: the comments of the
  task, oldest first, and a field to write a new one.
- Writing `@` in the field offers the people involved in the task; a chosen person is tagged.
- A tagged person receives a notification that opens the task.
- The author of a comment, or an admin, can delete it.
- The description of an existing task opens as a read view with an «Изменить» button, and starts
  half as tall.
- Opening a task puts it in the address (`?task=<id>`), closing it takes it out, so the
  address can be copied and the browser's back button closes the task.

## Capabilities

### New Capabilities
- `task-comments`: comments on a task, tagging people, the tag notification.
- `task-link`: the address of an opened task.
- `task-description-view`: the description opens for reading.

### Modified Capabilities

## Impact

- `apps/api`: `task_comment` table, `TASK_MENTIONED` notification kind, `/api/tasks/:id/comments`.
- `apps/web`: comments section in the task dialog, notification text, task address handling on
  the tasks page and in the archive.
