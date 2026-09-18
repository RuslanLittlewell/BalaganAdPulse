## Why

The task form asks for a project before it will save anything, which is the right rule for
agency work but the wrong one for the note a media buyer writes to themselves. It also shows
the project, the campaign and the responsible member as three separate concerns, each with
its own control, when they are one thought: who this is for and who is doing it. And the
dialog is narrow enough that a checklist and a description compete for the same few hundred
pixels.

## What Changes

- **BREAKING** A task may stand without a project. Creating one naming no project is stored
  rather than refused, and an existing task's project can be cleared.
- A task with no project is reached by the member who created it, the member responsible for
  it, and any admin of the organization — the project's grants cannot answer for it.
- A task with no project SHALL carry no campaign and cannot be shared with a client: both
  come from the project.
- The form's blocks are shown in one fixed order under the description, whatever order they
  were added in: the checklist, then the dates, then **Назначить** — one block carrying the
  project, the campaign and the responsible member together.
- Each block is separated from the next by a horizontal line and carries its remove control
  at its right edge.
- The **Видно клиенту** switch moves out of the blocks and into the dialog's footer, beside
  the buttons that act on the task as a whole.
- The dialog is wider, so a description and a checklist are not squeezed into one narrow
  column.

## Capabilities

### New Capabilities

### Modified Capabilities
- `task-board`: a task may stand without a project, and what that means for who reaches it,
  for its campaign and for sharing it with a client; the form composes its blocks in one
  fixed order, with the project, the campaign and the responsible member in one block.

## Impact

- **API**: `Task.projectId` becomes nullable — one migration, no data moved. The create and
  update schemas accept no project; the reach rules gain the author-or-responsible case for a
  task without one; naming a campaign or sharing with a client without a project is refused.
  The audit event for such a task carries no client.
- **Web**: `TaskFormDialog` gains the fixed block order, the `Назначить` block, the
  separators and the wider dialog; the client switch moves to the footer; the board and the
  calendar already show a task with no project as **Без проекта**.
- **Dependencies**: none added.
