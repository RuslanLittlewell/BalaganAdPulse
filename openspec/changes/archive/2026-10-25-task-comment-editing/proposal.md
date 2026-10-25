## Why

Writing a task comment feels unlike the messengers the team lives in: Enter adds a line instead of
sending, the send button sits apart from the field, and a typo can only be fixed by deleting the
comment and writing it again.

## What Changes

- The comment field behaves like Telegram's: Enter sends, Shift+Enter starts a new line, the field
  grows with its text, and the send control sits inside it.
- The author of a comment can edit it: in the same field, under an «Редактирование» bar, with
  Escape cancelling and the up arrow in an empty field editing the author's last comment. An edited
  comment is marked «изменено».
- Editing can tag more people; only those newly tagged are notified.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `task-comments`: the composer sends on Enter; a comment can be edited by its author.

## Impact

- API: `task_comment.edited_at` and migration; `PATCH /tasks/:id/comments/:commentId`; `editedAt`
  on comments and in OpenAPI.
- Web: `TaskComments` composer and editing, `useEditTaskComment`, `ru.ts` copy.
