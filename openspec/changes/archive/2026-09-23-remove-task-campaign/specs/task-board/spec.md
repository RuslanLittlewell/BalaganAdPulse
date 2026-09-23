## REMOVED Requirements

### Requirement: A task may name one campaign of its project

**Reason**: Tasks no longer carry a campaign at all — only a project, as a whole. There is
nothing left within a project for a task to narrow to.

**Migration**: A task's stored `campaignId` is dropped by the accompanying migration. No
replacement field exists; a task that named a campaign is simply a task of its project from
here on.

### Requirement: Moving a task to another project releases its campaign

**Reason**: This requirement only existed to keep a task's campaign consistent with its
project. With no campaign field left on a task, the rule it protected no longer applies.

**Migration**: None — moving a task to another project is unaffected; there is nothing left
to release.

### Requirement: Deleting a campaign leaves its tasks standing

**Reason**: This protected tasks from losing their project when their named campaign was
deleted. With no task naming a campaign, deleting a campaign has nothing left to affect on
the task side.

**Migration**: None. Deleting a campaign continues to behave as the `campaign-metrics`
capability specifies for campaigns themselves; it was never able to affect a task's project
or existence, only its (now-removed) campaign field.

### Requirement: Tasks can be listed for one campaign

**Reason**: With no task naming a campaign, there is nothing left to filter the task listing
by. `CampaignPage`'s "Задачи кампании" section, the only caller of this filter, is removed
with it.

**Migration**: None. The task listing keeps its project filter; the campaign filter is
dropped from the query, the API and the OpenAPI schema with no replacement.

### Requirement: Work in flight is visible beside the figures

**Reason**: This requirement described a project's in-flight task list and a campaign's own
task list together. With no task naming a campaign, the campaign half no longer applies;
replaced by a narrower requirement covering only the project's list.

**Migration**: Replaced by "Work in flight is visible beside a project's figures", which
keeps the project's in-flight list exactly as it was and drops the campaign scenario.

### Requirement: A task can be read without being changed

**Reason**: This requirement described opening a task read-only from a project's list or a
campaign's list, and the case of a task naming no campaign. With no task naming a campaign,
there is no campaign screen to open a task from, and no "about the project as a whole"
distinction left to state.

**Migration**: Replaced by "A task can be read from its project without being changed",
which keeps the project-list case and drops the campaign-list case and the no-campaign
scenario.

## ADDED Requirements

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
- **THEN** the project says there is no work in flight rather than showing an empty table

### Requirement: A task can be read from its project without being changed

Opening a task from a project's list SHALL show it read-only: its title, description as
written, stage, priority, project and responsible member, with no control that edits, moves
or deletes it. The description SHALL render the same content the editor would show,
including the images it references.

This screen is for reading; the board is where work is managed. A read-only view SHALL be
offered whatever the member's role, since it grants nothing beyond what listing the task
already did.

#### Scenario: Opening a task from a project

- **WHEN** a member opens a task from the project's list
- **THEN** the task's title, description, stage, priority and responsible member are shown,
  and no control changes any of them

#### Scenario: Closing the view

- **WHEN** the member closes the dialog
- **THEN** the list is still shown, unchanged

## MODIFIED Requirements

### Requirement: The board shows the work that is the member's own

What a member sees on the board SHALL be narrowed by whose work it is, not only by which
projects they reach:

- An `ADMIN` SHALL see every task in the organization.
- A `MANAGER` or `GUEST` SHALL see only the tasks they are responsible for. There is no
  exception: a task nobody is responsible for is seen by admins alone until one of them
  makes somebody responsible for it.
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
- **THEN** no manager or guest sees it, and every admin does

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

### Requirement: Completing a repeating task moves it to its next occurrence

A repeating task SHALL offer completion as its own operation. Completing it SHALL, in one
atomic step, move that same task's due date forward by its interval, keep its time of day
and untick every checklist item. The task SHALL stay in the column and at the position it
already holds, so completion moves it in time and never on the board. No second task SHALL
be created, and the task SHALL keep its title, description, priority, responsible member,
project and images.

Completion SHALL be refused for a task that does not repeat; such a task is finished by
moving it to `DONE` as before.

The next occurrence SHALL be counted from the task's own due date rather than from today,
so a task completed late keeps its rhythm. A monthly task due on a day the next month does
not have SHALL fall on that month's last day.

#### Scenario: A weekly call is held

- **WHEN** a member completes a task that repeats weekly and is due Wednesday 17 September
  at 12:00
- **THEN** the same task is due Wednesday 24 September at 12:00, stays in the column it was
  in, and no second task exists

#### Scenario: The card does not move on the board

- **WHEN** a member completes a repeating task sitting second in `IN_PROGRESS`
- **THEN** the task is still second in `IN_PROGRESS`, and the cards around it keep their
  positions

#### Scenario: The checklist starts again

- **WHEN** a member completes a repeating task whose three checklist items are all ticked
- **THEN** the task keeps all three items, none of them ticked

#### Scenario: Completing late keeps the rhythm

- **WHEN** a task repeating weekly and due Wednesday 17 September is completed on Friday
  19 September
- **THEN** it becomes due Wednesday 24 September

#### Scenario: A month that is too short

- **WHEN** a task repeating monthly and due 31 January is completed
- **THEN** it becomes due 28 February, or 29 February in a leap year

#### Scenario: Completing a task that does not repeat

- **WHEN** a member completes a task whose interval is `NONE`
- **THEN** the API responds 400 and the task is unchanged

### Requirement: A task is composed from the blocks of content it is given

The task form SHALL open showing only a title, a description and a priority. The checklist,
the dates and the block that names a project and a responsible member SHALL NOT be shown
until they are asked for.

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

- **WHEN** a member opens the form to create a task
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
