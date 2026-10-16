## 1. A task may be stored without a project

- [x] 1.1 Write and observe failing API tests for creating a task naming no project, for
  clearing the project of a task that had one, for the task keeping its column and position
  when it happens, and for a task with no project reading back with none.
- [x] 1.2 Drop `NOT NULL` from `task.project_id` in `schema.prisma` and write the migration.
- [x] 1.3 Carry a null project through the task ports, the Prisma repository, the Zod schemas
  and the OpenAPI document, and write the audit event with no client for such a task.
- [x] 1.4 Run `npm test` and `npm run test:web` until both are green.

## 2. Who reaches a task with no project

- [x] 2.1 Write and observe failing API tests: the member who created it sees it, the member
  responsible for it sees it, an admin sees it, a colleague gets 404 by id and nothing in the
  listing, and a `CLIENT` never sees it whatever the task is marked.
- [x] 2.2 Widen the reach filter with the author-or-responsible case for a task with no
  project, leaving the project case as it is.
- [x] 2.3 Run `npm test` and `npm run test:web` until both are green.

## 3. A campaign and a client both need a project

- [x] 3.1 Write and observe failing API tests for naming a campaign on a task with no project
  being refused 400, for clearing a project clearing the campaign with it, and for marking a
  projectless task visible to the client being refused 400.
- [x] 3.2 Refuse a campaign and the client mark without a project in the task use cases, and
  clear the campaign when the project is cleared.
- [x] 3.3 Run `npm test` and `npm run test:web` until both are green.

## 4. The form composes its blocks in one fixed order

- [x] 4.1 Write and observe failing web tests for the row offering `Чек-лист`, `Даты` and
  `Назначить`; for `Назначить` showing the project, the campaign and the responsible member
  together; for the blocks appearing as checklist, dates, `Назначить` whatever order they were
  added in; and for removing `Назначить` saving a task with none of the three.
- [x] 4.2 Write and observe failing web tests for a task saved with no project, and for the
  project select offering `Без проекта`.
- [x] 4.3 Render the blocks by mapping the block list, replace the `assignee` and `campaign`
  blocks with `Назначить`, and let the project be cleared.
- [x] 4.4 Run `npm test` and `npm run test:web` until both are green.

## 5. The dialog's shape

- [x] 5.1 Write and observe failing web tests for the `Видно клиенту` switch being in the
  footer, absent while the task has no project, and absent for a member who may not change it.
- [x] 5.2 Move the switch into the footer, separate the blocks with a horizontal line, put each
  block's remove control at its right edge, and widen the dialog.
- [x] 5.3 Add every new string to `ru.ts` and reach it through `t("key")`.
- [x] 5.4 Run the web production build, then `npm test` and `npm run test:web` until both are
  green.

## 6. Close the change

- [x] 6.1 Run `openspec validate let-tasks-stand-without-a-project --strict` and confirm the
  implementation matches every scenario in the delta spec.
- [x] 6.2 Update `README.md` where it describes what a task belongs to and how the form is
  filled in.
