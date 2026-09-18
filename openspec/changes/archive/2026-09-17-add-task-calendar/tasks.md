## 1. The due date reaches the API

- [x] 1.1 Write and observe failing API tests for creating and updating a task with a due
  date and no time, with a due date and a time, for a time without a day being refused 400,
  for clearing the due date, and for the day reading back unchanged whatever the reader's
  clock.
- [x] 1.2 Add `due_date`, `due_time` and the `task_repeat` enum column to `schema.prisma`
  with the `CHECK` constraints and the `(org_id, due_date)` index, and create the migration.
- [x] 1.3 Carry the due date through the task ports, the Prisma repository, the use cases,
  the Zod schemas and the OpenAPI document, formatting the day with the existing
  `formatDate`.
- [x] 1.4 Add `dueFrom`/`dueTo` to `GET /api/tasks`, its filter in the repository and its
  OpenAPI parameters, with a test that a range returns only the tasks due inside it.
- [x] 1.5 Run `npm test` and `npm run test:web` until both are green.

## 2. Checklists

- [x] 2.1 Write and observe failing API tests for adding, renaming, ticking, reordering and
  removing an item, for a blank title being refused 400, for items riding on the task as it
  is read, for a deleted task taking its items, and for a guest being refused 403.
- [x] 2.2 Add `task_checklist_item` to `schema.prisma` with the cascade and the
  `(task_id, position)` index, and extend the migration from 1.2.
- [x] 2.3 Implement the checklist endpoints, use cases, repository and audit entries, and
  add them to the OpenAPI document.
- [x] 2.4 Run `npm test` and `npm run test:web` until both are green.

## 3. Repetition and completion

- [x] 3.1 Write and observe failing unit tests for the interval arithmetic: each of the four
  intervals, a completion counted from the task's own date rather than today, and 31 January
  monthly landing on the last day of February in a common and a leap year.
- [x] 3.2 Implement the interval arithmetic as a pure function in the tasks domain.
- [x] 3.3 Write and observe failing API tests for `POST /api/tasks/:id/complete`: the due
  date advancing, the time of day surviving, the checklist unticking, the task keeping its
  column and its position, no second task existing, a non-repeating task being refused 400,
  an interval
  without a due date being refused 400, clearing the due date of a repeating task being
  refused 400, a guest being refused 403, and the audit event naming both dates.
- [x] 3.4 Implement the completion use case and endpoint, publishing `task.updated`.
- [x] 3.5 Run `npm test` and `npm run test:web` until both are green.

## 4. The task form learns the new fields

- [x] 4.1 Write and observe failing web tests for the task form setting and clearing a due
  date, adding a time, choosing a repetition interval, and editing the checklist.
- [x] 4.2 Extend the task entity's types, queries and mutations with the due date, the
  repetition, the checklist and the completion call.
- [x] 4.3 Add the due date, time, repetition and checklist controls to `TaskFormDialog`,
  reusing the shared `DatePicker`, and show the due date and checklist progress on
  `TaskCard` and in `TaskPreviewDialog`.
- [x] 4.4 Add every new string to `ru.ts` and reach it through `t("key")`.
- [x] 4.5 Run `npm test` and `npm run test:web` until both are green.

## 5. The week calendar

- [x] 5.1 Write and observe failing web tests for the calendar showing Monday to Sunday of
  the week holding today, marking today, naming the week, moving to the previous and next
  week and back to today, drawing an empty day, hiding tasks without a due date, and
  ordering a day by time before the untimed tasks.
- [x] 5.2 Build `widgets/task-calendar` over the existing `useTasks()` cache, with the week
  arithmetic in a tested module of its own.
- [x] 5.3 Write and observe failing web tests for dragging a card into another day setting
  its due date while keeping its time, for the card being drawn in the new day before the
  server answers, for a refused move returning it and telling the member, and for a guest
  being unable to drag.
- [x] 5.4 Wire dnd-kit day droppables with the optimistic cache update and its rollback.
- [x] 5.5 Write and observe a failing web test for completing a repeating task from the
  calendar moving its card to the next week's day.
- [x] 5.6 Add the completion control to the repeating task's card and preview.
- [x] 5.7 Run `npm test` and `npm run test:web` until both are green.

## 6. Switching views

- [x] 6.1 Write and observe failing web tests for the tabs showing one view at a time,
  switching from the keyboard, exposing the selected tab, remembering the choice across a
  reload, starting on the board when nothing is remembered, and keeping one person's choice
  off another person signing in on the same browser.
- [x] 6.2 Add `shared/ui/FadeContent` over `motion`, and the view tabs to `TasksPage`, with
  the remembered choice stored per signed-in person.
- [x] 6.3 Run the web production build, then `npm test` and `npm run test:web` until both are
  green.

## 7. Close the change

- [x] 7.1 Run `openspec validate add-task-calendar --strict` and confirm the implementation
  matches every scenario in the two delta specs.
- [x] 7.2 Update `README.md` and `docs/` where the tasks module is described.
