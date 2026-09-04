# task-board Specification

## Purpose
A task is a unit of work under a project, shown as a card on a Kanban board. The board is
where the agency sees what is being worked on, who is responsible for it, how urgent it is,
and which stage it has reached.

## Requirements

### Requirement: A task belongs to exactly one project

Every task SHALL belong to exactly one project, named when the task is created and
changeable afterwards. A task SHALL NOT exist without a project.

#### Scenario: Creating a task without a project
- **WHEN** a member creates a task and names no project
- **THEN** the API responds 400 and no task is stored

#### Scenario: Creating a task under an unreachable project
- **WHEN** a member creates a task naming a project they hold no grant for
- **THEN** the API responds 404, the same answer a genuinely missing project id gets

#### Scenario: Moving a task to another project
- **WHEN** a member changes a task's project to another project they can reach
- **THEN** the task is stored against the new project and still appears on the board

### Requirement: A task carries a title, description, priority and responsible member

A task SHALL carry a non-empty title and a priority of `LOW`, `MEDIUM`, `HIGH` or `URGENT`.
It SHALL optionally carry a rich-text description and a responsible member. The description
SHALL round-trip unchanged, including references to the images embedded in it.

#### Scenario: Creating a task with only the required fields
- **WHEN** a member creates a task with a title, a project and a priority
- **THEN** the task is stored with an empty description and no responsible member

#### Scenario: Creating a task with a blank title
- **WHEN** a member creates a task whose title is empty or only whitespace
- **THEN** the API responds 400 and no task is stored

#### Scenario: Description survives a round trip
- **WHEN** a member saves a description containing formatted text and two images, then
  reads the task back
- **THEN** the formatting and both image references are returned as they were saved

#### Scenario: Description cannot carry active content
- **WHEN** a description is submitted containing a script or an event-handler attribute
- **THEN** the stored description carries neither, and reading the task back never returns
  content that executes in the browser

### Requirement: The board has six fixed columns

A task SHALL sit in exactly one of six columns: `IDEA`, `ARCHIVED`, `IN_PROGRESS`,
`NEEDS_FIX`, `IN_REVIEW`, `DONE`. The set is fixed — members SHALL NOT add, rename or remove
columns. The board SHALL present them in that order, left to right. A task created without a
named column SHALL land in `IDEA`.

#### Scenario: Default column
- **WHEN** a member creates a task without naming a column
- **THEN** the task is stored in `IDEA` and appears in the first column of the board

#### Scenario: Unknown column rejected
- **WHEN** a request names a column outside the six
- **THEN** the API responds 400 and the task is unchanged

#### Scenario: Empty column is still shown
- **WHEN** the board is opened and no task sits in `NEEDS_FIX`
- **THEN** the `NEEDS_FIX` column is still drawn, empty, in its place in the order

### Requirement: Tasks are ordered within their column

Tasks SHALL carry an explicit position within their column and SHALL be returned in
ascending position order, so the board's order is stable across reloads and independent of
when a task was created or last edited.

#### Scenario: Order survives a reload
- **WHEN** a member drags the bottom card of a column to the top and reloads the board
- **THEN** that card is still at the top

#### Scenario: Editing a task does not move it
- **WHEN** a member changes a task's title or priority
- **THEN** the task keeps its position in its column

### Requirement: A task moves between and within columns in one operation

Moving a task SHALL name its target column and its target position, and SHALL be applied as
a single atomic operation together with the repositioning of the tasks around it. A refused
move SHALL leave every task's column and position unchanged.

#### Scenario: Dragging a card to another column
- **WHEN** a member drops a card from `IN_PROGRESS` into `IN_REVIEW` between two cards
- **THEN** the task is stored in `IN_REVIEW` at that position, and the cards below it move
  down by one

#### Scenario: The board reflects the move before the server answers
- **WHEN** a member drops a card in a new place
- **THEN** the card is drawn in its new place immediately, without waiting for the response

#### Scenario: A refused move is undone on screen
- **WHEN** the server refuses a move
- **THEN** the card returns to the place it was dragged from, and the member is told the
  move did not happen

#### Scenario: Position beyond the end of a column
- **WHEN** a move names a position past the last card of the target column
- **THEN** the task is placed last in that column rather than refused

### Requirement: The responsible member is an active member of the organization

A task's responsible member SHALL be a membership in the same organization as the task's
project, and that membership SHALL be active. Clearing the responsible member SHALL be
permitted at any time.

#### Scenario: Assigning a member of another organization
- **WHEN** a member sets a membership from a different organization as responsible
- **THEN** the API responds 400 and the task's responsible member is unchanged

#### Scenario: Assigning a suspended member
- **WHEN** a member sets a suspended membership as responsible
- **THEN** the API responds 400 and the task's responsible member is unchanged

#### Scenario: Unassigning
- **WHEN** a member clears the responsible member of an assigned task
- **THEN** the task is stored with no responsible member and stays in its column

#### Scenario: A removed member's tasks survive
- **WHEN** an admin removes a member who is responsible for several tasks
- **THEN** those tasks remain on the board with no responsible member

### Requirement: Tasks follow the access rules of their project

A member SHALL reach a task exactly when they reach the project it belongs to. A task inside
an unreachable project SHALL answer 404 rather than 403, so the response does not reveal
that it exists.

#### Scenario: The board is filtered to what the member reaches
- **WHEN** a manager granted two of the organization's ten clients opens the board
- **THEN** only tasks belonging to projects of those two clients are shown

#### Scenario: Admin sees the whole organization
- **WHEN** an admin opens the board
- **THEN** tasks from every project in their organization are shown

#### Scenario: Fetching an unreachable task by id
- **WHEN** a member requests a task inside a project they hold no grant for
- **THEN** the API responds 404

### Requirement: Only admins and managers change tasks

Creating, updating, moving and deleting a task SHALL be permitted to `ADMIN` and `MANAGER`
only. A `GUEST` SHALL read the board and be refused every write. A `CLIENT` SHALL NOT reach
tasks at all — the board is the agency's internal work.

#### Scenario: Guest drags a card
- **WHEN** a guest drops a card in another column
- **THEN** the API responds 403, the task keeps its column and position, and the card
  returns to where it was

#### Scenario: Guest sees no editing controls
- **WHEN** a guest opens the board
- **THEN** the create button and the card menus are absent, and cards cannot be dragged

#### Scenario: Client-role member opens the board
- **WHEN** a member with the `CLIENT` role requests the board or any task
- **THEN** the API responds 403 and no task is returned

### Requirement: Every task mutation is audited

Creating, updating, moving and deleting a task SHALL each write an audit event in the same
transaction as the mutation, naming the member who made the change.

#### Scenario: A move is recorded
- **WHEN** a manager drags a task from `IN_PROGRESS` to `DONE`
- **THEN** an audit event records that member, that task, and the column it moved between

#### Scenario: A failed mutation writes no audit event
- **WHEN** a task update is refused
- **THEN** no audit event is written for it

### Requirement: Deleting a task removes it from the board

Deleting a task SHALL remove it from the board and SHALL close the gap it leaves in its
column's order.

#### Scenario: Deleting a card from the middle of a column
- **WHEN** an admin deletes the second of four cards in a column
- **THEN** the remaining three keep their relative order with no gap between them

#### Scenario: Deletion is confirmed first
- **WHEN** a member chooses to delete a task
- **THEN** they are asked to confirm, and the task survives if they decline

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

### Requirement: Moving a task to another project releases its campaign

Changing a task's project SHALL leave the task without a campaign, unless the same
request names a campaign of the new project. A task SHALL never be stored against a
campaign outside its own project, whatever order the two fields are changed in.

#### Scenario: Changing the project alone

- **WHEN** a member moves a task with a campaign to another project, naming no campaign
- **THEN** the task is stored under the new project with no campaign

#### Scenario: Changing the project and the campaign together

- **WHEN** a member moves a task to another project and names a campaign of that project
  in the same request
- **THEN** the task is stored under the new project against the named campaign

#### Scenario: Changing the project and naming the old campaign

- **WHEN** a member moves a task to another project while naming a campaign of the old one
- **THEN** the API responds 400 and neither the project nor the campaign changes

### Requirement: Deleting a campaign leaves its tasks standing

Deleting a campaign SHALL NOT delete the tasks that named it. Each such task SHALL be
left with no campaign, becoming a task about the project as a whole. Work outlives the
campaign it was about.

#### Scenario: A campaign with outstanding work is deleted

- **WHEN** a campaign named by two tasks is deleted
- **THEN** both tasks still exist, still under their project, each with no campaign

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

- **WHEN** a member opens a project or a campaign screen
- **THEN** the tasks listed there are the ones their board would show, on the same rule

### Requirement: A task is either the agency's own or shared with the client

Every task SHALL record whether it is visible to the client. A task is the agency's own
by default: work the agency does about a customer is not addressed to them.

- A task raised by a `CLIENT` SHALL be marked visible to the client when it is created.
  They raised it; it is theirs to see.
- A task raised by anybody else SHALL be marked as the agency's own.
- Only an `ADMIN` SHALL change that mark. A `MANAGER` may create, edit and complete a
  task, but deciding what a customer is shown is the agency's to make in one place.

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
