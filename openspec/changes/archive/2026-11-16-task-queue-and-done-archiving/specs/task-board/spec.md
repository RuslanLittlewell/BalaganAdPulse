## RENAMED Requirements

- FROM: `### Requirement: The board has six fixed columns`
- TO: `### Requirement: The board has seven fixed columns`

## MODIFIED Requirements

### Requirement: The board has seven fixed columns

A task SHALL sit in exactly one of seven columns: `IDEA`, `QUEUED`, `IN_PROGRESS`,
`NEEDS_FIX`, `IN_REVIEW`, `DONE`, `ARCHIVED`. The set is fixed — members SHALL NOT add, rename or remove
columns. The board SHALL present them in that order, left to right. A task created without a
named column SHALL land in `IDEA`.

#### Scenario: Default column
- **WHEN** a member creates a task without naming a column
- **THEN** the task is stored in `IDEA` and appears in the first column of the board

#### Scenario: Unknown column rejected
- **WHEN** a request names a column outside the seven
- **THEN** the API responds 400 and the task is unchanged

#### Scenario: Empty column is still shown
- **WHEN** the board is opened and no task sits in `NEEDS_FIX`
- **THEN** the `NEEDS_FIX` column is still drawn, empty, in its place in the order

#### Scenario: The queue follows the ideas
- **WHEN** the board is opened
- **THEN** the В очереди column is drawn second, between Идея and В работе

### Requirement: Work in flight is visible beside a project's figures

A project SHALL show the tasks under it that are still in flight — those in the `IDEA`,
`QUEUED`, `IN_PROGRESS`, `NEEDS_FIX` and `IN_REVIEW` stages. Tasks that are done or archived SHALL
be left out: the list answers "what is being worked on", not "what has ever existed".

#### Scenario: A project with work at several stages

- **WHEN** a member opens a project whose tasks span every stage
- **THEN** the tasks in the five in-flight stages are listed, and the done and archived
  ones are not

#### Scenario: A project with nothing in flight

- **WHEN** every task under a project is done or archived
- **THEN** the project says there is no work in flight rather than showing an empty table,
  unless the member may create tasks, who is offered the Новая задача tile in its place

### Requirement: The task form shows and changes the task's stage

The task form's header SHALL offer, next to the priority, an Этап select to a member permitted to
change the task. A client opening a task they may not change SHALL see the select showing its
stage, disabled. A client raising a task SHALL be offered none. It SHALL list the seven stages in the board's order and SHALL show
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
- **THEN** it lists Идея, В очереди, В работе, На исправление, На проверке, Готово and Архив, in the board's
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

#### Scenario: A client reads the stage of a task on a project

- **WHEN** a client opens a task on a project
- **THEN** Этап shows its stage and cannot be changed

#### Scenario: The move is refused

- **WHEN** the server refuses the move of a task whose stage was changed in its form
- **THEN** the task stays in its stage, the form stays open, and the member is told the move did
  not happen
