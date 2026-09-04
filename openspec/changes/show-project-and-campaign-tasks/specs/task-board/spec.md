## ADDED Requirements

### Requirement: Tasks can be listed for one campaign

The task listing SHALL accept a campaign alongside the project it already accepts, and
answer only the tasks naming that campaign. Reach is unchanged: a member is answered
only the tasks whose project they reach, so a campaign filter can never widen what they
see.

#### Scenario: Listing a campaign's tasks

- **WHEN** a member lists tasks naming a campaign of a project they reach
- **THEN** only the tasks naming that campaign are returned

#### Scenario: A campaign filter does not widen reach

- **WHEN** a member lists tasks naming a campaign under a project they hold no grant for
- **THEN** no tasks are returned, and the answer is the same as for a campaign that does
  not exist

#### Scenario: Listing without a campaign

- **WHEN** a member lists tasks naming no campaign filter
- **THEN** every task they reach is returned, whether it names a campaign or not

### Requirement: Work in flight is visible beside the figures

A project SHALL show the tasks under it that are still in flight — those in the `IDEA`,
`IN_PROGRESS`, `NEEDS_FIX` and `IN_REVIEW` stages. Tasks that are done or archived SHALL
be left out: the list answers "what is being worked on", not "what has ever existed".

A campaign SHALL show the tasks that name it, at whatever stage, because a campaign's
work is small enough to read whole and its finished work is part of its history.

#### Scenario: A project with work at several stages

- **WHEN** a member opens a project whose tasks span every stage
- **THEN** the tasks in the four in-flight stages are listed, and the done and archived
  ones are not

#### Scenario: A project with nothing in flight

- **WHEN** every task under a project is done or archived
- **THEN** the project says there is no work in flight rather than showing an empty table

#### Scenario: A campaign's own work

- **WHEN** a member opens a campaign
- **THEN** the tasks naming that campaign are listed, and tasks of the same project
  naming another campaign or none are not

### Requirement: A task can be read without being changed

Opening a task from a project or campaign screen SHALL show it read-only: its title,
description as written, stage, priority, project, campaign and responsible member, with
no control that edits, moves or deletes it. The description SHALL render the same
content the editor would show, including the images it references.

These screens are for reading; the board is where work is managed. A read-only view SHALL
be offered whatever the member's role, since it grants nothing beyond what listing the
task already did.

#### Scenario: Opening a task from a project

- **WHEN** a member opens a task from the project's list
- **THEN** the task's title, description, stage, priority, campaign and responsible
  member are shown, and no control changes any of them

#### Scenario: A task about the project as a whole

- **WHEN** the opened task names no campaign
- **THEN** the dialog states that it is about the project as a whole

#### Scenario: Closing the view

- **WHEN** the member closes the dialog
- **THEN** the list is still shown, unchanged
