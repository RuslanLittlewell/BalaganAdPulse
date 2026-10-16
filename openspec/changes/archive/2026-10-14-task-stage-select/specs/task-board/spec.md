## ADDED Requirements

### Requirement: The task form shows and changes the task's stage

The task form's header SHALL offer, next to the priority, an Этап select to a member permitted to
change tasks, and to nobody else. It SHALL list the six stages in the board's order and SHALL show
the task's current stage; for a new task it SHALL show the stage the task will be created in — the
column the form was opened from, or `IDEA`.

The chosen stage SHALL take effect when the task is saved and not before, exactly as a change to
the title does. Saving an existing task with another stage chosen SHALL move it to the first
position of that stage, as one move that obeys every rule a dragged move does; saving it with its
stage unchanged SHALL leave its column and position untouched. A new task SHALL be created in the
stage chosen. A refused move SHALL leave the task where it was, keep the form open and tell the
member the move did not happen.

#### Scenario: The current stage is shown

- **WHEN** a manager opens a task sitting in `IN_PROGRESS`
- **THEN** the form's header shows Этап: В работе, next to the priority

#### Scenario: Every stage is offered

- **WHEN** a manager opens the Этап select
- **THEN** it lists Идея, В работе, На исправление, На проверке, Готово and Архив, in the board's
  order

#### Scenario: Moving a task from its form

- **WHEN** a manager chooses На проверке for a task in `IN_PROGRESS` and saves
- **THEN** the task is first in `IN_REVIEW`, and the cards that were below it in `IN_PROGRESS`
  move up by one

#### Scenario: Saving without changing the stage

- **WHEN** a manager renames a task sitting third in `IN_PROGRESS` and saves
- **THEN** the task is still third in `IN_PROGRESS`

#### Scenario: Closing without saving

- **WHEN** a manager chooses Готово and closes the form without saving
- **THEN** the task is in the stage it was in

#### Scenario: A new task from a column

- **WHEN** a manager opens the form from the `NEEDS_FIX` column's add control
- **THEN** Этап shows На исправление, and the task saved from it is created in `NEEDS_FIX`

#### Scenario: Choosing a stage for a new task

- **WHEN** a manager creating a task chooses В работе and saves
- **THEN** the task is created in `IN_PROGRESS`

#### Scenario: A client is not offered it

- **WHEN** a client opens the form to raise a task
- **THEN** no Этап select is shown, and the task is created in `IDEA`

#### Scenario: The move is refused

- **WHEN** the server refuses the move of a task whose stage was changed in its form
- **THEN** the task stays in its stage, the form stays open, and the member is told the move did
  not happen

## MODIFIED Requirements

### Requirement: A task is composed from the blocks of content it is given

The task form SHALL open showing only a title, a description, a priority and, to a member
permitted to change tasks, the task's stage. The checklist, the dates and the block that names a
project and a responsible member SHALL NOT be shown until they are asked for, unless the new task
already carries a value for them.

A new task SHALL start with the member filling in the form as its responsible member
whenever the responsible-member picker offers them, unless the form was opened for
another responsible member. The `Назначить` block is then shown from the start with them
chosen, and they MAY pick somebody else, clear the field or remove the block before
saving. A member the picker does not offer, such as a customer, SHALL start with nobody
responsible.

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

#### Scenario: A new task starts with its creator responsible

- **WHEN** a manager opens the form to create a task
- **THEN** the title, the description, the priority and the stage are shown, the `Назначить`
  block is shown with the manager chosen as responsible and no project, and no checklist or due
  date is

#### Scenario: Saving without touching the responsible member

- **WHEN** a manager creates a task without changing who is responsible
- **THEN** the task is stored with the manager as its responsible member

#### Scenario: A new task starts bare

- **WHEN** a client opens the form to create a task
- **THEN** the title, the description and the priority are shown, and no stage, checklist, due
  date, project or responsible member is

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
