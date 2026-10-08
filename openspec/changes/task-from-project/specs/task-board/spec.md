## ADDED Requirements

### Requirement: A task can be raised from its project

The list of a project's work in flight SHALL offer a Новая задача tile to a member who may
create tasks, after the tasks it lists, or alone in place of the note that nothing is in
flight. It SHALL NOT be offered to anyone else. Choosing it SHALL open the task form
for a new task that already names that project and, when the member is among the
responsible members the form offers, names the member themselves as responsible; the
`Назначить` block SHALL therefore be shown from the start. Both SHALL stay changeable before
the task is saved. A task saved this way SHALL appear in the project's list while it is in
flight.

#### Scenario: Raising a task for oneself

- **WHEN** a manager chooses Новая задача under a project, enters a title and saves
- **THEN** the task is stored under that project with the manager responsible for it, and
  appears in the project's work in flight

#### Scenario: The form opens assigned

- **WHEN** a manager chooses Новая задача under a project
- **THEN** the form shows the `Назначить` block naming that project and the manager, and
  does not offer `Назначить` in the row

#### Scenario: Giving it to a colleague

- **WHEN** the manager picks a colleague as responsible before saving
- **THEN** the task is stored with the colleague responsible for it

#### Scenario: The tile follows the tasks

- **WHEN** a manager opens a project with two tasks in flight
- **THEN** the Новая задача tile comes after both tasks

#### Scenario: The tile in place of an empty list

- **WHEN** a manager opens a project with nothing in flight
- **THEN** the Новая задача tile is shown alone, without the note that nothing is in flight

#### Scenario: A member who may not create tasks

- **WHEN** a guest opens a project
- **THEN** its work in flight offers no Новая задача tile

### Requirement: A task opens from its project as it does in the task module

Choosing a task in a project's list of work in flight SHALL open it exactly as choosing it on
the task board does: in the task form, where it can be changed, saved and deleted after
confirmation, for a member who may update tasks; read-only, with no control that changes
it, for anyone else. A change saved there SHALL show in the project's list at once, and a
task deleted or moved out of the in-flight stages SHALL leave it.

#### Scenario: A manager opens a task from a project

- **WHEN** a manager chooses a task in a project's work in flight
- **THEN** the task form opens holding that task's values

#### Scenario: Saving a change

- **WHEN** the manager renames the task in that form and saves
- **THEN** the project's list shows the new title

#### Scenario: Deleting from the project

- **WHEN** the manager deletes the task from that form and confirms
- **THEN** the task is deleted and leaves the project's list

#### Scenario: A guest opens a task from a project

- **WHEN** a guest chooses a task in a project's work in flight
- **THEN** the task is shown read-only, with no control that changes it

### Requirement: A task in flight is shown as the board shows it

Each task in a project's list of work in flight SHALL be shown on the same card as on the
task board — its title, priority, due date with its time of day and a mark when it
repeats, checklist progress, attachments, project and responsible member — with its stage
added, since the list has no columns to show it, and with no control for dragging it.
Cards SHALL take the height their content needs.

#### Scenario: A task with everything

- **WHEN** a task in flight is due on 2 October at 14:00 every day, has 2 of 3 checklist
  items ticked and 2 attachments
- **THEN** its card shows 02.10 14:00 with a repeat mark, 2/3 and 2 attachments, beside its
  title, priority, stage and responsible member

#### Scenario: A bare task

- **WHEN** a task in flight has no due date, checklist or attachments
- **THEN** its card shows nothing standing in for them

#### Scenario: Nothing to drag

- **WHEN** a manager looks at a project's work in flight
- **THEN** no card offers a control for dragging it

## MODIFIED Requirements

### Requirement: Work in flight is visible beside a project's figures

A project SHALL show the tasks under it that are still in flight — those in the `IDEA`,
`IN_PROGRESS`, `NEEDS_FIX` and `IN_REVIEW` stages. Tasks that are done or archived SHALL
be left out: the list answers "what is being worked on", not "what has ever existed".

#### Scenario: A project with work at several stages

- **WHEN** a member opens a project whose tasks span every stage
- **THEN** the tasks in the four in-flight stages are listed, and the done and archived
  ones are not

#### Scenario: A project with nothing in flight

- **WHEN** every task under a project is done or archived
- **THEN** the project says there is no work in flight rather than showing an empty table,
  unless the member may create tasks, who is offered the Новая задача tile in its place

### Requirement: A task is composed from the blocks of content it is given

The task form SHALL open showing only a title, a description, a priority and the blocks
holding a value the task already carries. The checklist, the dates and the block that names
a project and a responsible member SHALL NOT otherwise be shown until they are asked for.

A row of controls under the title SHALL offer each block a task does not yet show —
`Чек-лист`, `Даты` and `Назначить`. Choosing one SHALL show that block and SHALL take it out
of the row, so a block is never offered twice. A block whose task already carries a value
SHALL be shown from the start and SHALL NOT be offered in the row.

Shown blocks SHALL appear under the description in one fixed order, whatever order they were
added in: the checklist, then the dates, then `Назначить`. `Назначить` SHALL carry the
project and the responsible member together, because they answer one question.

Each block SHALL be separated from what precedes it by a horizontal line and SHALL carry its
remove control at its right edge. Removing a block SHALL clear everything it held, so what
the form shows and what the task carries never disagree. Attachments SHALL keep their own
place and SHALL NOT be part of the row.

Whether the task is visible to the client SHALL NOT be a block: it belongs in the dialog's
footer, next to the controls that act on the task as a whole.

#### Scenario: A new task starts bare

- **WHEN** a member opens the form to create a task from the task module
- **THEN** the title, the description and the priority are shown, and no checklist, due date,
  project or responsible member is

#### Scenario: Adding a block

- **WHEN** a member chooses `Чек-лист` from the row
- **THEN** the checklist block appears and `Чек-лист` is no longer offered in the row

#### Scenario: One block for who it is for and who does it

- **WHEN** a member chooses `Назначить` from the row
- **THEN** the project and the responsible member appear together in one block

#### Scenario: The order does not follow the adding

- **WHEN** a member adds `Назначить`, then `Даты`, then `Чек-лист`
- **THEN** the blocks are shown as the checklist, the dates, then `Назначить`

#### Scenario: A task that already carries a value

- **WHEN** a member opens a task that is due on 25 September and has two checklist items
- **THEN** both blocks are shown, and neither `Даты` nor `Чек-лист` is offered in the row

#### Scenario: Removing a block clears it

- **WHEN** a member removes the `Даты` block from a task due on 25 September at 12:00 that
  repeats weekly, and saves
- **THEN** the task is stored with no due date, no time of day and no repetition, and
  `Даты` is offered in the row again

#### Scenario: Removing the responsible member

- **WHEN** a member clears the responsible member inside the `Назначить` block and saves
- **THEN** the task is stored with nobody responsible, and the block stays because it still
  names a project

#### Scenario: Removing the block that names a project

- **WHEN** a member removes the `Назначить` block from a task that has a project and a
  responsible member, and saves
- **THEN** the task is stored with neither

#### Scenario: Blocks are told apart

- **WHEN** two blocks are shown
- **THEN** a horizontal line separates them, and each carries a remove control at its right
  edge

#### Scenario: The client mark is not a block

- **WHEN** an admin opens a task on a project
- **THEN** the `Видно клиенту` switch is in the dialog's footer, and the row offers no
  control for it

#### Scenario: Attachments are not a block

- **WHEN** a member opens the form to create a task
- **THEN** the attachments block is in its usual place and the row offers no control for it

## REMOVED Requirements

### Requirement: A task can be read from its project without being changed

**Reason**: A task opened from its project now opens as it does in the task module, so a
member who may change tasks no longer has to go to the board to do it.
**Migration**: See "A task opens from its project as it does in the task module"; members
who may not update tasks still get the read-only view.
