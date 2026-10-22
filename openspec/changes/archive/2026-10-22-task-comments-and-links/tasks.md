## 1. API

- [x] 1.1 Add the `task_comment` table and the `TASK_MENTIONED` notification kind.
- [x] 1.2 Add comment use cases (list, add, delete) with the access and tagging rules, and the `/api/tasks/:id/comments` routes with their OpenAPI schemas.
- [x] 1.3 Notify tagged members with `TASK_MENTIONED`.

## 2. Web

- [x] 2.1 Add the comments entity (api, queries) and the `TASK_MENTIONED` notification text.
- [x] 2.2 Build the comments section with `@` tagging and add it to the task dialog.
- [x] 2.3 Keep the opened task in the address on the tasks page and the archive.

## 3. Verification

- [x] 3.1 Cover the API rules, the notification, the comments section, and the address handling.
- [x] 3.2 Run `npm test` until green; `openspec validate task-comments-and-links --strict`.
