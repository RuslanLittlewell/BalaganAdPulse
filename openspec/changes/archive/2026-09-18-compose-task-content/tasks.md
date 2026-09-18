## 1. A task is created with its checklist

- [x] 1.1 Write and observe failing API tests for creating a task with three items stored in
  order and unticked, for creating one with no checklist, for a blank item title refusing the
  whole creation with 400, for a refused creation leaving no item behind, and for the items
  coming back with the task on the board.
- [x] 1.2 Accept `checklist` in `createTaskSchema` and document it in the OpenAPI create
  operation.
- [x] 1.3 Write the items inside the transaction the create use case already opens, through
  the existing checklist repository methods, and leave `updateTaskSchema` alone.
- [x] 1.4 Run `npm test` and `npm run test:web` until both are green.

## 2. The checklist works on a task that does not exist yet

- [x] 2.1 Write and observe failing web tests for the checklist block over a draft: adding,
  ticking, renaming and removing an item send nothing to the server, a blank item is refused,
  and the progress count follows the draft.
- [x] 2.2 Give `TaskChecklist` its items and callbacks as props instead of a task id, keeping
  the stored-task path on the existing mutations.
- [x] 2.3 Hold the draft checklist in the form and send it with the task on create.
- [x] 2.4 Write and observe a failing web test for creating a task whose request carries the
  items that were written, then make it pass.
- [x] 2.5 Run `npm test` and `npm run test:web` until both are green.

## 3. A stored task's checklist changes only when the task is saved

- [x] 3.1 Write and observe failing API tests for updating a task with a checklist: the given
  list replacing the stored one in the order given with its ticks, an update naming no
  checklist leaving it alone, an empty checklist emptying it, a blank item title refusing the
  whole update with 400, and the checklist surviving an update that only changes the title.
- [x] 3.2 Accept `checklist` in `updateTaskSchema`, add an `updateChecklist` repository method
  that replaces the task's rows inside the caller's transaction, and write it in the update
  use case before its audit event.
- [x] 3.3 Remove the five per-item endpoints, their use cases, their repository methods and
  their OpenAPI operations, and the tests that covered them.
- [x] 3.4 Write and observe failing web tests for the form: ticking, adding and removing an
  item sends nothing until the task is saved, saving sends the whole list, and closing the
  form without saving leaves the task alone.
- [x] 3.5 Hold the checklist of a task being edited in the form, drop the per-item mutation
  hooks, and send the list with the task.
- [x] 3.6 Run `npm test` and `npm run test:web` until both are green.

## 4. The form composes a task from blocks

- [x] 4.1 Write and observe failing web tests for a new task showing only the title,
  description, project and priority; for the row offering `Даты`, `Чек-лист`,
  `Ответственный` and `Кампания`; for choosing one showing its block and taking it out of the
  row; and for the attachments block staying out of the row.
- [x] 4.2 Write and observe failing web tests for a task that already carries a due date and a
  checklist opening with both blocks shown and neither offered in the row.
- [x] 4.3 Write and observe failing web tests for removing a block: removing `Даты` saves a
  task with no due date, time or repetition and puts `Даты` back in the row, and removing
  `Ответственный` saves a task with nobody responsible.
- [x] 4.4 Derive the shown blocks from the opened set and the form's own values, add the
  control row and a remove control on each block, and move the campaign and responsible
  selects into blocks of their own.
- [x] 4.5 Add every new string to `ru.ts` and reach it through `t("key")`.
- [x] 4.6 Run the web production build, then `npm test` and `npm run test:web` until both are
  green.

## 5. Close the change

- [x] 5.1 Run `openspec validate compose-task-content --strict` and confirm the implementation
  matches every scenario in the delta spec.
- [x] 5.2 Update the task section of `README.md` where it describes what a task carries and
  how the form is filled in.
