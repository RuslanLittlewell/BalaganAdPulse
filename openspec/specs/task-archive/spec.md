# task-archive Specification

## Purpose
TBD - created by archiving change task-archive-module. Update Purpose after archive.

## Requirements

### Requirement: A task remembers when it was archived

The system SHALL record the moment a task enters the archive column and SHALL expose it as
`archivedAt`. A task in any other column SHALL have no `archivedAt`. Reordering tasks inside the
archive column SHALL NOT change the moment of a task already in it.

#### Scenario: Archiving a task
- **WHEN** a task is moved into the archive column
- **THEN** its `archivedAt` is the time of the move

#### Scenario: Reordering the archive
- **WHEN** another task in the archive column is dragged to a new position
- **THEN** the `archivedAt` of the tasks already archived is unchanged

#### Scenario: Restoring a task
- **WHEN** an archived task is moved to another column
- **THEN** its `archivedAt` is empty

### Requirement: Long-archived tasks leave the board

A task that has been in the archive column for seven days or more SHALL be shelved. The task
board and the calls view SHALL NOT show a shelved task. A task in the archive column for less than
seven days SHALL stay on the board.

#### Scenario: A week in the archive
- **WHEN** a task has been in the archive column for seven days
- **THEN** the task board does not show it

#### Scenario: Recently archived
- **WHEN** a task has been in the archive column for two days
- **THEN** the task board still shows it in the archive column and the archive module does not

### Requirement: The archive module lists shelved tasks

The «Архив» module SHALL list the shelved tasks the member may see as rows, the most recently
archived first. Each row SHALL show the title, project, participants and the archiving date.
The module SHALL offer a project filter and a participant filter that narrow the list the way
they do on the tasks page, remembered separately from the tasks page's. Opening a row SHALL open
the task dialog. With no shelved tasks the module SHALL say that the archive is empty.

#### Scenario: Listing
- **WHEN** a member opens the archive module and two tasks are shelved
- **THEN** both are listed, the one archived later first

#### Scenario: Narrowing by project
- **WHEN** a member picks a project in the project filter
- **THEN** only the shelved tasks of that project are listed

#### Scenario: Narrowing by participant
- **WHEN** a member picks a participant in the participant filter
- **THEN** only the shelved tasks that participant takes part in are listed

#### Scenario: Nothing shelved
- **WHEN** no task is shelved
- **THEN** the module says the archive is empty

### Requirement: A task remembers when it was done

The system SHALL record the moment a task enters the `DONE` column and SHALL keep it while the
task stays there. Reordering tasks inside `DONE` SHALL NOT change the moment of a task already
in it, and a task that leaves `DONE` SHALL lose it, so a task that is reopened and done again
starts its day anew.

#### Scenario: Reordering the done column
- **WHEN** another task is dragged to a new position in `DONE`
- **THEN** the tasks already in `DONE` keep the moment they entered it

#### Scenario: Doing a task again
- **WHEN** a task is moved out of `DONE` and back into it
- **THEN** its day in `DONE` is counted from the second move

### Requirement: A done task is archived a day after it was done

A task that has stayed in `DONE` for 24 hours SHALL be moved to the first position of the archive
column without anybody acting, within a few minutes of the 24 hours passing. The move SHALL
stamp `archivedAt` as any other move into the archive does, SHALL close the gap the task leaves
in `DONE`, and SHALL reach the open boards of the members who see the task the way a member's
move does. A task that has been in `DONE` for less than 24 hours SHALL stay there. A task that
was in `DONE` when this rule was introduced SHALL have its 24 hours counted from that moment.

#### Scenario: A day in done
- **WHEN** a task has been in `DONE` for 24 hours
- **THEN** it is first in the archive column, its `archivedAt` is set, and the tasks that were
  below it in `DONE` move up by one

#### Scenario: Done this morning
- **WHEN** a task has been in `DONE` for three hours
- **THEN** it is still in `DONE`

#### Scenario: Reopened before the day passed
- **WHEN** a task is moved from `DONE` to `IN_PROGRESS` after 20 hours and 24 hours pass since it
  was done
- **THEN** it is still in `IN_PROGRESS`

#### Scenario: An open board follows the move
- **WHEN** a task is archived this way while a member who sees it has the board open
- **THEN** the card moves to the archive column on their board without a reload

### Requirement: An admin approves a done task into the archive

A card in `DONE` SHALL carry a В архив control for an `ADMIN` and for nobody else. Using it SHALL
move the task to the first position of the archive column as one move that obeys every rule a
dragged move does, so the approval is audited as a move made by that admin. A card in any other
column SHALL carry no such control. A refused approval SHALL leave the task in `DONE` and tell
the admin the move did not happen.

#### Scenario: An admin approves
- **WHEN** an admin uses В архив on a card in `DONE`
- **THEN** the task is first in the archive column, and an audit event records that admin and
  the move from `DONE` to `ARCHIVED`

#### Scenario: A manager is not offered it
- **WHEN** a manager opens the board with a task in `DONE`
- **THEN** the card carries no В архив control

#### Scenario: Only done tasks are approved
- **WHEN** an admin opens the board with a task in `IN_REVIEW`
- **THEN** the card carries no В архив control
