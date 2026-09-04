## Purpose

A task is a unit of work under a project, shown as a card on a Kanban board. The board is
where the agency sees what is being worked on, who is responsible for it, how urgent it is,
and which stage it has reached.

## ADDED Requirements

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
