Every task follows the repository's TDD rule: the failing test comes first and is observed
failing before the implementation it covers. The module follows the template in
README — API architecture; nothing lives outside `modules/`, `shared/` and `composition/`.

## 1. Schema and storage groundwork

- [x] 1.1 Confirm the prerequisite is in place: `Organization`, `Membership`, `ClientAccess` and `AuditEvent` exist in `apps/api/prisma/schema.prisma`. If they do not, stop.
- [x] 1.2 Write the failing test: a task row persists with `IDEA` and an appended position when neither is given, and deleting its project removes it.
- [x] 1.3 Add the `TaskColumn` and `TaskPriority` enums and the `Task` and `TaskImage` models to the Prisma schema with the indexes and delete behaviour from design.md — Migration Plan, generate the migration, and make 1.2 pass.
- [x] 1.4 Write the failing test: `putObject`/`getObject` round-trip a JPEG and preserve its content type.
- [x] 1.5 Add `putObject`/`getObject` to `apps/api/src/shared/infrastructure/storage.ts`, re-express `putPng`/`getPng` as wrappers over them, and make 1.4 pass with the existing avatar tests still green.
- [x] 1.6 Run `npm test` and `npm run test:web` — both green.

## 2. Task domain

- [x] 2.1 Write the failing pure tests: the six columns in their fixed order, `IDEA` as the default, the four priorities, and a move that renumbers source and target densely from zero with a position past the end clamped to last.
- [x] 2.2 Implement `modules/tasks/domain` — columns, priorities and the position arithmetic — with no Express, Zod, Prisma or process globals.
- [x] 2.3 Run `npm test` and `npm run test:web` — both green.

## 3. Task use cases

- [x] 3.1 Write the failing application tests for reading: ordered by column then position, filtered to the actor's reach, the whole organization for an admin, readable by a guest, refused to a `CLIENT`.
- [x] 3.2 Write the failing application tests for create, update and delete: blank title and unknown column refused, unreachable project answers not-found, defaults to `IDEA` appended last, an assignee from another organization or a suspended one refused, a guest refused every write, only `ADMIN` and `MANAGER` may delete, and each mutation appends one audit event.
- [x] 3.3 Write the failing application tests for the move: both columns left densely numbered, a position past the end clamped, a refused move leaving every task untouched, and the audit event naming the columns moved between.
- [x] 3.4 Implement `modules/tasks/application` — ports and use cases — against in-memory ports, a fixed clock and deterministic ids.
- [x] 3.5 Run `npm test` and `npm run test:web` — both green.

## 4. Task persistence and HTTP

- [x] 4.1 Write the failing Prisma adapter tests: reach translated for admin, whole-client grant, project-scoped grant and no grant; dense renumbering across two columns in one transaction; and rollback leaving positions untouched.
- [x] 4.2 Implement the Prisma task repository, translating reach in the adapter as the other modules do.
- [x] 4.3 Write the failing HTTP tests for `GET /api/tasks`, `GET /api/tasks/:id`, `POST /api/tasks`, `PATCH /api/tasks/:id`, `DELETE /api/tasks/:id` and `POST /api/tasks/:id/move`, covering statuses, the error envelope and 404-not-403 for an unreachable task.
- [x] 4.4 Implement the HTTP adapter with its Zod schemas and wire the module in `create-container.ts` and `create-routes.ts`.
- [x] 4.5 Run `npm test` and `npm run test:web` — both green.

## 5. Task images

- [x] 5.1 Write the failing tests for accepting an upload: PNG, JPEG, WebP and GIF by magic number, a PDF renamed `.png` refused, and a file over 10 MB refused.
- [x] 5.2 Implement the image type and size rules in the tasks domain, and the storage adapter writing under the `tasks/` prefix.
- [x] 5.3 Write the failing tests for `POST /api/task-images`: the object is stored and a `TaskImage` recorded with its uploader and a null task.
- [x] 5.4 Write the failing tests for `GET /api/task-images/:id`: served to its uploader before any task references it, 404 to another member while unattached, 404 once attached to an unreachable task, served when reachable, and refused without a token.
- [x] 5.5 Implement both endpoints through the module's use cases and adapters.
- [x] 5.6 Write the failing tests: saving a description claims the images it references, and deleting the task removes both the rows and the stored objects.
- [x] 5.7 Implement claiming on save and object removal on delete.
- [x] 5.8 Run `npm test` and `npm run test:web` — both green.

## 6. The board screen

- [x] 6.1 Add `@dnd-kit/core`, `@dnd-kit/sortable` and the `@tiptap` packages to `apps/web/package.json`, and run `npm install` so the lock file records them.
- [x] 6.2 Write the failing test: the board draws the six columns in the order Идея, Архив, В работе, На исправление, На проверке, Готово, draws an empty column in its place, and orders cards within a column by position.
- [x] 6.3 Build `entities/task` (types, api, React Query hooks) and `widgets/task-board` with the column order in one exported constant.
- [x] 6.4 Replace `ModulePage` on `ROUTES.tasks` with a new `pages/tasks`, and add the Russian copy for columns, priorities, the dialog and its errors to `apps/web/src/shared/config/ru.ts`.
- [x] 6.5 Run `npm test` and `npm run test:web` — both green.

## 7. Drag and drop

- [x] 7.1 Write the failing tests: dropping a card into another column sends the move and draws the card in its new place before the response arrives, and a refused move returns it to where it was dragged from and reports the failure.
- [x] 7.2 Implement the sortable board with `@dnd-kit`, including the keyboard sensor, and an optimistic React Query mutation that rolls back on error.
- [x] 7.3 Write the failing tests: a guest sees no create button and no card menus, and cannot drag a card.
- [x] 7.4 Gate the controls on the shared permission matrix rather than on a local role check.
- [x] 7.5 Run `npm test` and `npm run test:web` — both green.

## 8. The task dialog and its editor

- [x] 8.1 Write the failing tests for the create dialog: a blank title and a missing project are both refused, priority is required, and the project and responsible-member selects list what the member can reach.
- [x] 8.2 Build `features/task-management` with the dialog, using `react-hook-form` and the existing `shared/ui` dialog and select.
- [x] 8.3 Write the failing tests for the editor: pasting an image uploads it and inserts it at the cursor, pasting text inserts text and uploads nothing, dropping a file outside the editor does nothing and does not navigate the page, and an oversized file reports the error and inserts no reference.
- [x] 8.4 Implement the TipTap editor with paste and drop upload, rendering images from object URLs fetched with credentials and revoking them on unmount, and load it lazily with the dialog.
- [x] 8.5 Write the failing test: reopening a saved task round-trips its formatted description and displays both of its images.
- [x] 8.6 Wire edit and delete-with-confirmation into the card menu, reusing `ConfirmDialog`.
- [x] 8.7 Run `npm test` and `npm run test:web` — both green.

## 9. Close out

- [x] 9.1 Document the module in `README.md` — the board, the six columns, the image limits, and the new `apps/web` dependencies.
- [x] 9.2 Run `openspec validate add-task-board --strict` and confirm it passes.
- [x] 9.3 Run `npm test`, `npm run test:web`, `npm run build` and `npm run build:web` — all green.
