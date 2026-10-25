## 1. API

- [x] 1.1 Add `edited_at` to `task_comment`; report `editedAt` on comments.
- [x] 1.2 Add `PATCH /tasks/:id/comments/:commentId` for the author, validating text and tags and notifying only newly tagged members; document it.

## 2. Web

- [x] 2.1 Make the composer send on Enter, break lines on Shift+Enter, grow with its text and hold the send control.
- [x] 2.2 Let the author edit a comment in the composer, with the bar, Escape, the up arrow and the «изменено» mark.

## 3. Verification

- [x] 3.1 Cover the edit route, the notices and the composer.
- [x] 3.2 Run the tests until green; `openspec validate task-comment-editing --strict`.
