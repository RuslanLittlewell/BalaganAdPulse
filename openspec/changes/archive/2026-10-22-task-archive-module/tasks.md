## 1. API

- [x] 1.1 Add `archived_at` to `task` with a backfill from `updated_at` for archived tasks; stamp it when a task enters the archive column, clear it elsewhere, and return `archivedAt`.

## 2. Web

- [x] 2.1 Add `archivedAt` to the task type and an `isShelved` rule to `entities/task`.
- [x] 2.2 Keep shelved tasks off the board and the calls view.
- [x] 2.3 Build the archive page: list rows, project and participant filters remembered separately, task dialog on open, empty state.

## 3. Verification

- [x] 3.1 Cover the stamping and clearing in the API, the shelving rule, and the archive page.
- [x] 3.2 Run `npm test` until green; `openspec validate task-archive-module --strict`.
