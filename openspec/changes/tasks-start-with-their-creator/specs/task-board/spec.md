## MODIFIED Requirements

### Requirement: The board shows the work that is the member's own

What a member sees on the board SHALL be narrowed by whose work it is, not only by which
projects they reach:

- An `ADMIN` SHALL see every task in the organization.
- A `MANAGER` or `GUEST` SHALL see the tasks they are responsible for, and the tasks
  nobody is responsible for that they created. A task nobody is responsible for is
  otherwise seen by admins alone; once somebody is made responsible for it, it is seen
  by that member and no longer by its creator.
- A `CLIENT` or `CLIENT_ADMIN` SHALL see only the tasks marked visible to the client, on
  the projects they reach. The two customer roles see the same work: the second
  administers people, not tasks.

Reach still applies first and independently: a task in a project a member cannot reach is
never shown, whoever it belongs to. This rule narrows what remains; it can never widen it.

A task a member cannot see SHALL be answered as not found, never as forbidden, so the
board cannot be used to learn that somebody else's work exists.

#### Scenario: A manager's board

- **WHEN** a manager opens the board on a project they are granted
- **THEN** the tasks they are responsible for are shown, and a colleague's are not

#### Scenario: A task nobody is responsible for

- **WHEN** a task on a granted project has no responsible member
- **THEN** the manager or guest who created it sees it, no other manager or guest does,
  and every admin does

#### Scenario: Creating a task with nobody responsible

- **WHEN** a manager creates a task on a granted project, leaves nobody responsible and
  opens the board
- **THEN** the task is on their board, they can open it by its address, and their other
  open boards receive it live

#### Scenario: A task the creator left unassigned is handed on

- **WHEN** an admin makes a colleague responsible for a task a manager created with nobody
  responsible
- **THEN** it leaves the creator's board and appears on the colleague's

#### Scenario: An admin hands a task to a manager

- **WHEN** an admin makes a manager responsible for a task that manager could not see
- **THEN** it appears on that manager's board

#### Scenario: A task handed to somebody else

- **WHEN** a manager creates a task and makes a colleague responsible for it
- **THEN** it leaves their board and appears on the colleague's

#### Scenario: An admin's board

- **WHEN** an admin opens the board
- **THEN** every task in the organization is shown, whoever is responsible

#### Scenario: A client's employee sees what the client sees

- **WHEN** a `CLIENT` and the `CLIENT_ADMIN` of the same client each open the task module
- **THEN** both see every task marked visible to the client on their projects, including
  the ones the other raised

#### Scenario: Neither sees the agency's own work

- **WHEN** either opens the address of an unmarked task on their own project
- **THEN** the answer is 404

#### Scenario: Opening somebody else's task directly

- **WHEN** a manager opens the address of a task a colleague is responsible for
- **THEN** the answer is 404, the same answer a task that does not exist gets

#### Scenario: The lists beside the figures follow the same rule

- **WHEN** a member opens a project's screen
- **THEN** the tasks listed there are the ones their board would show, on the same rule

### Requirement: A task is composed from the blocks of content it is given

The task form SHALL open showing only a title, a description and a priority. The checklist,
the dates and the block that names a project and a responsible member SHALL NOT be shown
until they are asked for, unless the new task already carries a value for them.

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
- **THEN** the title, the description and the priority are shown, the `Назначить` block is
  shown with the manager chosen as responsible and no project, and no checklist or due date
  is

#### Scenario: Saving without touching the responsible member

- **WHEN** a manager creates a task without changing who is responsible
- **THEN** the task is stored with the manager as its responsible member

#### Scenario: A new task starts bare

- **WHEN** a client opens the form to create a task
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

