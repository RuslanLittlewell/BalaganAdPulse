## 1. Schema and storage groundwork

- [ ] 1.1 Confirm the prerequisite is in place: `Organization`, `Membership`, `AuditEvent` and a project reachable through an access grant all exist in `apps/api/prisma/schema.prisma`. If they do not, stop — `add-agency-crm-foundation` must be implemented first.
- [ ] 1.2 Write the failing test: a task row persists with `IDEA` and an appended position when neither is given, and deleting its project removes it.
- [ ] 1.3 Add the `TaskColumn` and `TaskPriority` enums and the `Task` and `TaskImage` models to the Prisma schema with the indexes and delete behaviour from design.md — Migration Plan, generate the migration, and make 1.2 pass.
- [ ] 1.4 Write the failing test: `putObject`/`getObject` round-trip a JPEG and preserve its content type.
- [ ] 1.5 Add `putObject`/`getObject` to `apps/api/src/lib/storage.ts`, re-express `putPng`/`getPng` as wrappers over them, and make 1.4 pass with the existing avatar tests still green.
- [ ] 1.6 Run `npm test` and `npm run test:web` — both green.

## 2. Reading tasks

- [ ] 2.1 Write the failing tests for `GET /api/tasks`: ordered by column then position, filtered to the member's grants, whole organization for an admin, readable by a guest, refused with 403 to a `CLIENT` member.
- [ ] 2.2 Implement the list in `task.service.ts` with its controller, routes and Zod schema, accept the optional `projectId` filter, and mount the router in `app.ts` behind `requireAuth`.
- [ ] 2.3 Write the failing tests for `GET /api/tasks/:id`: returned when the project is reachable, 404 when it is not, and 404 for a missing id.
- [ ] 2.4 Implement reading a single task.
- [ ] 2.5 Run `npm test` and `npm run test:web` — both green.

## 3. Creating, updating and deleting tasks

- [ ] 3.1 Write the failing tests for `POST /api/tasks`: 400 on a blank title, on a missing project and on an unknown column; 404 on an unreachable project; defaults to `IDEA` and appends to the end of the column; 400 when the assignee is from another organization or is suspended.
- [ ] 3.2 Implement create, writing the audit event in the same transaction as the insert.
- [ ] 3.3 Write the failing tests for `PATCH /api/tasks/:id`: changing the title or priority leaves column and position untouched, the assignee can be cleared, the project can be changed to another reachable project, and a guest is refused 403.
- [ ] 3.4 Implement update, with its audit event in the same transaction.
- [ ] 3.5 Write the failing tests for `DELETE /api/tasks/:id`: the remaining cards in the column close the gap, only `ADMIN` and `MANAGER` may delete, and a refused delete writes no audit event.
- [ ] 3.6 Implement delete, with its audit event in the same transaction.
- [ ] 3.7 Run `npm test` and `npm run test:web` — both green.

## 4. Moving a task

- [ ] 4.1 Write the failing tests for `POST /api/tasks/:id/move`: an insert between two cards of another column leaves both columns densely numbered from zero, a position past the end clamps to last, a refused move leaves every task's column and position unchanged, a guest is refused 403, and the audit event names the columns moved between.
- [ ] 4.2 Implement the move as one `prisma.$transaction` that renumbers the source and target columns, per design.md — Positions are dense integers.
- [ ] 4.3 Run `npm test` and `npm run test:web` — both green.

## 5. Task images

- [ ] 5.1 Write the failing tests for `POST /api/task-images`: PNG, JPEG, WebP and GIF are accepted by their magic number, a PDF renamed `.png` is refused 400, and a file over 10 MB is refused 400.
- [ ] 5.2 Add `apps/api/src/lib/task-image.ts` with the type and size checks, and implement the upload — storing the object under the `tasks/` prefix and recording a `TaskImage` with `uploaderId` and a null `taskId`.
- [ ] 5.3 Write the failing tests for `GET /api/task-images/:id`: served to its uploader before any task references it, 404 to another member while it is unattached, 404 once attached to a task the caller cannot reach, and served when they can.
- [ ] 5.4 Implement the authenticated image read.
- [ ] 5.5 Write the failing tests: saving a description claims the images it references onto the task, and deleting the task removes both the rows and the stored objects.
- [ ] 5.6 Implement claiming on save and object removal on delete.
- [ ] 5.7 Run `npm test` and `npm run test:web` — both green.

## 6. The board screen

- [ ] 6.1 Add `@dnd-kit/core`, `@dnd-kit/sortable` and the `@tiptap` packages to `apps/web/package.json`.
- [ ] 6.2 Write the failing test: the board draws the six columns in the order Идея, Архив, В работе, На исправление, На проверке, Готово, draws an empty column in its place, and orders cards within a column by position.
- [ ] 6.3 Build `entities/task` (types, api, React Query hooks) and `widgets/task-board` with the column order in one exported constant.
- [ ] 6.4 Replace `ModulePage` on `ROUTES.tasks` with a new `pages/tasks`, and add the Russian copy for columns, priorities, the dialog and its errors to `apps/web/src/shared/config/ru.ts`.
- [ ] 6.5 Run `npm test` and `npm run test:web` — both green.

## 7. Drag and drop

- [ ] 7.1 Write the failing tests: dropping a card into another column sends the move and draws the card in its new place before the response arrives, and a refused move returns it to where it was dragged from and reports the failure.
- [ ] 7.2 Implement the sortable board with `@dnd-kit`, including the keyboard sensor, and an optimistic React Query mutation that rolls back on error.
- [ ] 7.3 Write the failing tests: a guest sees no create button and no card menus, and cannot drag a card.
- [ ] 7.4 Gate the controls on the shared permission matrix rather than on a local role check.
- [ ] 7.5 Run `npm test` and `npm run test:web` — both green.

## 8. The task dialog and its editor

- [ ] 8.1 Write the failing tests for the create dialog: a blank title and a missing project are both refused, priority is required, and the project and responsible-member selects list what the member can reach.
- [ ] 8.2 Build `features/task-management` with the dialog, using `react-hook-form` and the existing `shared/ui` dialog and select.
- [ ] 8.3 Write the failing tests for the editor: pasting an image uploads it and inserts it at the cursor, pasting text inserts text and uploads nothing, dropping a file outside the editor does nothing and does not navigate the page, and an oversized file reports the error and inserts no reference.
- [ ] 8.4 Implement the TipTap editor with paste and drop upload, rendering images from object URLs fetched with credentials and revoking them on unmount, and load it lazily with the dialog.
- [ ] 8.5 Write the failing test: reopening a saved task round-trips its formatted description and displays both of its images.
- [ ] 8.6 Wire edit and delete-with-confirmation into the card menu, reusing `ConfirmDialog`.
- [ ] 8.7 Run `npm test` and `npm run test:web` — both green.

## 9. Close out

- [ ] 9.1 Document the module in `README.md` — the board, the six columns, the image limits, and the new `apps/web` dependencies.
- [ ] 9.2 Run `openspec validate add-task-board --strict` and confirm it passes.
- [ ] 9.3 Run `npm test` and `npm run test:web` from the repository root — both green.
