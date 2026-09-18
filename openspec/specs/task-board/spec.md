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

Creating, updating, moving, completing and deleting a task, and every change to its
checklist, SHALL be permitted to `ADMIN` and `MANAGER` only. A `GUEST` SHALL read the board
and be refused every write. A `CLIENT` SHALL NOT reach tasks at all — the board is the
agency's internal work.

#### Scenario: Guest drags a card
- **WHEN** a guest drops a card in another column
- **THEN** the API responds 403, the task keeps its column and position, and the card
  returns to where it was

#### Scenario: Guest sees no editing controls
- **WHEN** a guest opens the board
- **THEN** the create button and the card menus are absent, and cards cannot be dragged

#### Scenario: Guest ticks a checklist item
- **WHEN** a guest ticks an item of a task's checklist
- **THEN** the API responds 403 and the item is unchanged

#### Scenario: Guest completes a repeating task
- **WHEN** a guest completes a repeating task
- **THEN** the API responds 403, the task keeps its due date, and a guest is offered no
  completion control

#### Scenario: Client-role member opens the board
- **WHEN** a member with the `CLIENT` role requests the board or any task
- **THEN** the API responds 403 and no task is returned

### Requirement: Every task mutation is audited

Creating, updating, moving, completing and deleting a task, and every change to its
checklist, SHALL each write an audit event in the same transaction as the mutation, naming
the member who made the change.

#### Scenario: A move is recorded
- **WHEN** a manager drags a task from `IN_PROGRESS` to `DONE`
- **THEN** an audit event records that member, that task, and the column it moved between

#### Scenario: A completion is recorded
- **WHEN** a manager completes a repeating task
- **THEN** an audit event records that member, that task, and the due date it moved between

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

### Requirement: A task may carry a due date

A task SHALL optionally carry a due date: a calendar day, and on that day an optional time
of day. A task SHALL NOT carry a time of day without a day. The day SHALL be the same
calendar day for every member whatever their machine's clock or time zone, and the time of
day SHALL be read as the agency's wall clock rather than converted for the reader.

Setting, changing and clearing the due date SHALL be permitted at any time, and SHALL leave
the task's column and position untouched.

#### Scenario: A task without a due date

- **WHEN** a member creates a task naming no due date
- **THEN** the task is stored with none, and the board shows it as it shows every other task

#### Scenario: A day with no time

- **WHEN** a member sets a task's due date to 25 September and names no time
- **THEN** the task reads back as due on 25 September with no time of day

#### Scenario: A day with a time

- **WHEN** a member sets a task's due date to 25 September at 12:00
- **THEN** the task reads back as due on 25 September at 12:00

#### Scenario: A time without a day

- **WHEN** a request names a time of day for a task that has no due date and names no day
- **THEN** the API responds 400 and the task's due date is unchanged

#### Scenario: Clearing the due date

- **WHEN** a member clears the due date of a task that had one
- **THEN** the task is stored with no due date and no time of day, and keeps its column and
  position

#### Scenario: The day does not drift

- **WHEN** a task due on 25 September is read by a member whose machine is three hours
  behind the agency
- **THEN** the task is still due on 25 September

### Requirement: A task may carry a checklist

A task SHALL optionally carry an ordered checklist. Each item SHALL have a non-empty title
and SHALL be either ticked or not, starting not ticked. The checklist SHALL be a property of
the task, given whole when the task is created and when it is updated: a change to it SHALL
take effect when the task is saved and not before, exactly as a change to the title does.
Items SHALL read back in the order they were given. Deleting a task SHALL delete its
checklist with it.

The checklist SHALL be reported as the number ticked out of the total, so progress is
visible without opening the task.

#### Scenario: Adding an item

- **WHEN** a member writes "Собрать креативы" into a task's checklist and saves
- **THEN** the item is stored last in the checklist, not ticked

#### Scenario: An item with a blank title

- **WHEN** a member saves a task carrying a checklist item whose title is empty or only
  whitespace
- **THEN** the API responds 400 and the checklist is unchanged

#### Scenario: Ticking an item

- **WHEN** a member ticks the second of three items and saves
- **THEN** that item reads back ticked, the other two unchanged, and the task reports 1 of 3

#### Scenario: A change that is not saved

- **WHEN** a member ticks an item and closes the form without saving
- **THEN** the task's checklist is as it was

#### Scenario: Order survives a reload

- **WHEN** a member saves a checklist with its last item first and reloads
- **THEN** that item is still at the top

#### Scenario: A deleted task takes its checklist

- **WHEN** an admin deletes a task that has four checklist items
- **THEN** the items are gone with it and no longer readable

#### Scenario: Ticking an item does not move the card

- **WHEN** a member ticks an item of a task in `IN_PROGRESS` and saves
- **THEN** the task keeps its column and its position

### Requirement: A task may repeat on an interval

A task SHALL carry a repetition interval of `NONE`, `DAILY`, `WEEKLY`, `BIWEEKLY` or
`MONTHLY`, defaulting to `NONE`. An interval other than `NONE` SHALL require a due date, so
there is a point to count from; a request setting one on a task without a due date SHALL be
refused, and clearing the due date of a repeating task SHALL be refused while it repeats.

#### Scenario: Making a task repeat weekly

- **WHEN** a member sets a task due on Wednesday 12:00 to repeat every week
- **THEN** the task reads back as repeating weekly, still due that Wednesday at 12:00

#### Scenario: Repetition without a due date

- **WHEN** a member sets an interval on a task that has no due date
- **THEN** the API responds 400 and the task does not repeat

#### Scenario: Clearing the due date of a repeating task

- **WHEN** a member clears the due date of a task that repeats weekly
- **THEN** the API responds 400 and both the due date and the interval are unchanged

#### Scenario: Stopping the repetition

- **WHEN** a member sets a repeating task's interval to `NONE`
- **THEN** the task keeps its due date and no longer repeats

### Requirement: Completing a repeating task moves it to its next occurrence

A repeating task SHALL offer completion as its own operation. Completing it SHALL, in one
atomic step, move that same task's due date forward by its interval, keep its time of day
and untick every checklist item. The task SHALL stay in the column and at the position it
already holds, so completion moves it in time and never on the board. No second task SHALL
be created, and the task SHALL keep its title, description, priority, responsible member,
project, campaign and images.

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

The task form SHALL open showing only a title, a description, a project and a priority. The
due date, the checklist, the responsible member and the campaign SHALL NOT be shown until
they are asked for.

A row of controls under the title SHALL offer each block a task does not yet show —
`Даты`, `Чек-лист`, `Ответственный` and `Кампания`. Choosing one SHALL show that block and
SHALL take it out of the row, so a block is never offered twice. A block whose task already
carries a value SHALL be shown from the start and SHALL NOT be offered in the row.

A shown block SHALL be removable, and removing it SHALL clear what it held, so what the
form shows and what the task carries never disagree. Attachments SHALL keep their own place
and SHALL NOT be part of the row.

#### Scenario: A new task starts bare

- **WHEN** a member opens the form to create a task
- **THEN** the title, the description, the project and the priority are shown, and no due
  date, checklist, responsible member or campaign is

#### Scenario: Adding a block

- **WHEN** a member chooses `Чек-лист` from the row
- **THEN** the checklist block appears and `Чек-лист` is no longer offered in the row

#### Scenario: A task that already carries a value

- **WHEN** a member opens a task that is due on 25 September and has two checklist items
- **THEN** both blocks are shown, and neither `Даты` nor `Чек-лист` is offered in the row

#### Scenario: Removing a block clears it

- **WHEN** a member removes the `Даты` block from a task due on 25 September at 12:00 that
  repeats weekly, and saves
- **THEN** the task is stored with no due date, no time of day and no repetition, and
  `Даты` is offered in the row again

#### Scenario: Removing the responsible member

- **WHEN** a member removes the `Ответственный` block from an assigned task and saves
- **THEN** the task is stored with nobody responsible

#### Scenario: Attachments are not a block

- **WHEN** a member opens the form to create a task
- **THEN** the attachments block is in its usual place and the row offers no control for it

### Requirement: A task's checklist is given whole with the task

Creating and updating a task SHALL accept the whole checklist, in the order it is to be
shown, and SHALL store it as given: items no longer present are gone, items present are kept
in that order with the ticks they are given. The task and its checklist SHALL be written in
one transaction, so a refused request leaves neither changed and a task never carries half of
a checklist.

Each item SHALL carry a non-empty title and SHALL be ticked or not, starting unticked. A
request naming an item with a blank title SHALL be refused as a whole. A request that names
no checklist at all SHALL leave the task's checklist as it is.

An item SHALL NOT be addressable on its own: there is no way to add, change, reorder or
remove one item without the task it belongs to.

#### Scenario: Creating a task with a checklist

- **WHEN** a member creates a task naming three checklist items
- **THEN** the task is stored with those three items, in that order, none of them ticked

#### Scenario: Creating a task without one

- **WHEN** a member creates a task naming no checklist
- **THEN** the task is stored with an empty checklist

#### Scenario: Replacing a checklist

- **WHEN** a member updates a task of three items, naming two of them in the other order with
  the first one ticked
- **THEN** the task carries those two items in the order given, the first ticked, and the
  third is gone

#### Scenario: Leaving a checklist alone

- **WHEN** a member updates a task's title and names no checklist
- **THEN** the task keeps every item it had, in its order, with its ticks

#### Scenario: Emptying a checklist

- **WHEN** a member updates a task naming an empty checklist
- **THEN** the task is stored with no items

#### Scenario: A blank item refuses the whole request

- **WHEN** a member creates or updates a task naming an item whose title is only whitespace
- **THEN** the API responds 400 and neither the task nor its checklist is changed

#### Scenario: A refused creation leaves no items

- **WHEN** a creation carrying a checklist is refused because the project cannot be reached
- **THEN** no task and no checklist item is stored

#### Scenario: The items come back with the task

- **WHEN** a member creates a task with two items and the board is read
- **THEN** the task carries both items and reports 0 of 2

#### Scenario: One item on its own

- **WHEN** a request addresses a single checklist item
- **THEN** the API offers no such route
