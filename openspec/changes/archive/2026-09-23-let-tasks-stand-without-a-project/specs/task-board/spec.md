## REMOVED Requirements

### Requirement: A task belongs to exactly one project

**Reason**: A task may now stand without a project, so the rule that every task has exactly
one no longer holds.

**Migration**: Replaced by "A task may belong to one project", which keeps every rule about
naming and changing a project and adds what happens when there is none. Stored tasks are
unaffected — each keeps the project it has.

## ADDED Requirements

### Requirement: A task may belong to one project

A task SHALL optionally belong to one project, named when the task is created and changeable
afterwards, including to none. A task with no project is the member's own note rather than
work about a customer, and SHALL be shown on the board and in the calendar as Без проекта.

#### Scenario: Creating a task without a project

- **WHEN** a member creates a task and names no project
- **THEN** the task is stored with none and appears on the board as Без проекта

#### Scenario: Creating a task under an unreachable project

- **WHEN** a member creates a task naming a project they hold no grant for
- **THEN** the API responds 404, the same answer a genuinely missing project id gets

#### Scenario: Moving a task to another project

- **WHEN** a member changes a task's project to another project they can reach
- **THEN** the task is stored against the new project and still appears on the board

#### Scenario: Taking a task out of its project

- **WHEN** a member clears the project of a task that had one
- **THEN** the task is stored with no project and stays on the board, in its column and at
  its position

### Requirement: A task with no project is reached by the members it belongs to

A task with no project SHALL be reached by the member who created it, by the member
responsible for it, and by every `ADMIN` of its organization. No other member SHALL reach
it, and to them it SHALL answer 404 rather than 403.

A `CLIENT` SHALL NOT reach a task with no project at all, whatever it is marked, because
such a task concerns no client.

#### Scenario: The member who wrote it

- **WHEN** a manager creates a task with no project and opens the board
- **THEN** the task is there, even though nobody is responsible for it

#### Scenario: The member it was given to

- **WHEN** an admin creates a task with no project and makes a manager responsible for it
- **THEN** that manager sees it on their board

#### Scenario: A colleague

- **WHEN** another manager, who neither wrote it nor is responsible for it, requests that
  task by id
- **THEN** the API responds 404

#### Scenario: An admin sees it

- **WHEN** an admin opens the board
- **THEN** every task of the organization is shown, including those with no project

#### Scenario: A client never sees it

- **WHEN** a member with the `CLIENT` role opens their board
- **THEN** no task without a project is shown

## MODIFIED Requirements

### Requirement: A task may name one campaign of its project

A task SHALL optionally name a campaign. The named campaign SHALL belong to the task's
own project; naming a campaign under any other project SHALL be refused. A task with no
campaign is about the project as a whole, and the interface SHALL present that as
**Общий** rather than as an empty or missing value.

No campaign SHALL be the default: a task created without naming one is stored with none.

#### Scenario: Creating a task on a campaign

- **WHEN** a member creates a task naming a campaign of the same project
- **THEN** the task is stored against that campaign and reads back with it

#### Scenario: Creating a task about the project as a whole

- **WHEN** a member creates a task naming no campaign
- **THEN** the task is stored with no campaign, and the board shows it as Общий

#### Scenario: Naming a campaign from another project

- **WHEN** a member creates or updates a task naming a campaign that belongs to a
  different project
- **THEN** the API responds 400 and the task's campaign is unchanged

#### Scenario: Naming a campaign that does not exist

- **WHEN** a member names a campaign id no campaign has, or one they cannot reach
- **THEN** the API responds 400, the same answer a campaign under another project gets,
  so an unreachable campaign is not distinguishable from an absent one

#### Scenario: Releasing a campaign

- **WHEN** a member updates a task naming no campaign where one was set
- **THEN** the task is stored with no campaign and becomes Общий

#### Scenario: Naming a campaign on a task with no project

- **WHEN** a member creates or updates a task that names a campaign but no project
- **THEN** the API responds 400 and the task carries no campaign

#### Scenario: Clearing the project of a task on a campaign

- **WHEN** a member clears the project of a task that named a campaign
- **THEN** the task is stored with neither, and the board shows it as Без проекта

### Requirement: A task is either the agency's own or shared with the client

Every task SHALL record whether it is visible to the client. A task is the agency's own
by default: work the agency does about a customer is not addressed to them.

- A task raised by a `CLIENT` SHALL be marked visible to the client when it is created.
  They raised it; it is theirs to see.
- A task raised by anybody else SHALL be marked as the agency's own.
- Only an `ADMIN` SHALL change that mark. A `MANAGER` may create, edit and complete a
  task, but deciding what a customer is shown is the agency's to make in one place.

A task with no project SHALL NOT be shared with a client: the client a task concerns comes
from its project, so there is nobody to share it with. The interface SHALL NOT offer the
mark on such a task, and a request setting it SHALL be refused.

Marking a task visible SHALL NOT change who is responsible for it or which stage it is at.

#### Scenario: A client raises a task

- **WHEN** a client creates a task on a project they reach
- **THEN** it is stored as visible to the client and appears on their board

#### Scenario: The agency's own work

- **WHEN** a manager or an admin creates a task
- **THEN** it is stored as the agency's own, and no client sees it

#### Scenario: An admin shares a task with the client

- **WHEN** an admin marks one of the agency's tasks visible to the client
- **THEN** the client sees it on their board, and the agency still does

#### Scenario: An admin takes a task back

- **WHEN** an admin unmarks a task that was visible to the client
- **THEN** the client no longer sees it, and the task itself is otherwise unchanged

#### Scenario: A manager tries to share a task

- **WHEN** a manager tries to change whether a task is visible to the client
- **THEN** the API refuses with 403 and the mark is unchanged

#### Scenario: A client tries to hide their own task

- **WHEN** a client tries to change the mark on a task they raised
- **THEN** the API refuses with 403

#### Scenario: Sharing a task that has no project

- **WHEN** an admin tries to mark a task with no project visible to the client
- **THEN** the API responds 400 and the task stays the agency's own

### Requirement: A task is composed from the blocks of content it is given

The task form SHALL open showing only a title, a description and a priority. The checklist,
the dates and the block that names a project, a campaign and a responsible member SHALL NOT
be shown until they are asked for.

A row of controls under the title SHALL offer each block a task does not yet show —
`Чек-лист`, `Даты` and `Назначить`. Choosing one SHALL show that block and SHALL take it out
of the row, so a block is never offered twice. A block whose task already carries a value
SHALL be shown from the start and SHALL NOT be offered in the row.

Shown blocks SHALL appear under the description in one fixed order, whatever order they were
added in: the checklist, then the dates, then `Назначить`. `Назначить` SHALL carry the
project, the campaign and the responsible member together, because they answer one question.

Each block SHALL be separated from what precedes it by a horizontal line and SHALL carry its
remove control at its right edge. Removing a block SHALL clear everything it held, so what
the form shows and what the task carries never disagree. Attachments SHALL keep their own
place and SHALL NOT be part of the row.

Whether the task is visible to the client SHALL NOT be a block: it belongs in the dialog's
footer, next to the controls that act on the task as a whole.

#### Scenario: A new task starts bare

- **WHEN** a member opens the form to create a task
- **THEN** the title, the description and the priority are shown, and no checklist, due date,
  project, campaign or responsible member is

#### Scenario: Adding a block

- **WHEN** a member chooses `Чек-лист` from the row
- **THEN** the checklist block appears and `Чек-лист` is no longer offered in the row

#### Scenario: One block for who it is for and who does it

- **WHEN** a member chooses `Назначить` from the row
- **THEN** the project, the campaign and the responsible member appear together in one block

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

- **WHEN** a member removes the `Назначить` block from a task that has a project, a campaign
  and a responsible member, and saves
- **THEN** the task is stored with none of the three

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
