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
