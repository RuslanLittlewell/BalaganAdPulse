## Why

Opening the task form shows every field a task could ever carry, whether or not this task
wants them: a project, a campaign, a responsible member, a priority, a due date, a repetition
interval. Most tasks are a title and a line of description, and the form asks them to walk
past six controls to say so. The checklist is worse off still — it appears only once the task
exists, so a task thought of as a list of steps has to be created first and filled in
afterwards.

## What Changes

- The task form opens bare. Only the title, the description, the project and the priority are
  shown; the due date, the checklist, the responsible member and the campaign are not.
- A row of controls under the title adds a block of content: **Даты**, **Чек-лист**,
  **Ответственный**, **Кампания**. Choosing one shows its block and takes it out of the row.
- A block whose task already carries a value — a due date on a task being edited, a checklist
  with items in it — is shown from the start and is not offered in the row.
- A shown block can be removed, which clears what it held: removing **Даты** clears the due
  date, the time of day and the repetition; removing **Ответственный** leaves the task with
  nobody responsible.
- The checklist is a property of the task, like its title: it starts empty, and adding,
  ticking, renaming and removing items changes the form, not the server. Every change takes
  effect when the task is saved, exactly as a changed title does.
- `POST /api/tasks` and `PATCH /api/tasks/:id` accept the whole checklist, in order, and
  store it with the task in one transaction, so a task never carries half of it.
- **BREAKING** The per-item endpoints — `POST`, `PATCH` and `DELETE` on
  `/api/tasks/:id/checklist[/:itemId]` and `/api/tasks/:id/checklist/reorder` — are removed.
  An item is no longer addressable on its own; the checklist travels with the task.
- Attachments keep their own block, unchanged, and are not part of the row.

No requirement is removed and no stored task changes: a task created without any of the
blocks is exactly the task that would be created today by leaving those fields alone.

## Capabilities

### New Capabilities

### Modified Capabilities
- `task-board`: a task's checklist may be given when the task is created, and the form
  composes a task from the blocks of content it is given rather than showing every field.

## Impact

- **API**: `POST /api/tasks` and `PATCH /api/tasks/:id` accept `checklist`; the use cases
  store it in the same transaction as the task; the five per-item endpoints, their use cases
  and their OpenAPI operations go. No migration — `task_checklist_item` already exists and
  keeps its shape.
- **Web**: `TaskFormDialog` holds which blocks are shown and the checklist it will save;
  `TaskChecklist` works on that list and never calls the API; the per-item mutation hooks go;
  a new control row; new strings in `ru.ts`.
- **Dependencies**: none added.
