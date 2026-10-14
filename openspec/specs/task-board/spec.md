# task-board Specification

## Purpose
A task is a unit of work under a project, shown as a card on a Kanban board. The board is
where the agency sees what is being worked on, who is responsible for it, how urgent it is,
and which stage it has reached.

## Requirements

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

### Requirement: A task may carry a due date

A task SHALL optionally carry a due date: a calendar day, and on that day an optional time
of day it starts at and, when it has one, an optional time of day it ends at. A task SHALL NOT
carry a time of day without a day, nor an end without a start, and its end SHALL be later than
its start on the same day, at the latest 24:00, the end of that day. The day SHALL be the same calendar day for every member whatever their
machine's clock or time zone, and the times of day SHALL be read as the agency's wall clock
rather than converted for the reader.

Setting, changing and clearing the due date SHALL be permitted at any time, and SHALL leave
the task's column and position untouched. Clearing the start SHALL clear the end. Changing the
start of a task that has an end, without naming a new end, SHALL keep the task's length, and
SHALL be refused when that would carry the end past the end of the day.

Wherever a task's time of day is shown, its end SHALL be shown with it, as 12:00–13:00.

#### Scenario: A task without a due date

- **WHEN** a member creates a task naming no due date
- **THEN** the task is stored with none, and the board shows it as it shows every other task

#### Scenario: A day with no time

- **WHEN** a member sets a task's due date to 25 September and names no time
- **THEN** the task reads back as due on 25 September with no time of day

#### Scenario: A day with a time

- **WHEN** a member sets a task's due date to 25 September at 12:00
- **THEN** the task reads back as due on 25 September at 12:00, with no end

#### Scenario: A time with an end

- **WHEN** a member sets a task's due date to 25 September from 12:00 to 13:30
- **THEN** the task reads back as due on 25 September from 12:00 to 13:30, and its card shows
  25.09 12:00–13:30

#### Scenario: A time without a day

- **WHEN** a request names a time of day for a task that has no due date and names no day
- **THEN** the API responds 400 and the task's due date is unchanged

#### Scenario: An end without a start

- **WHEN** a request names an end for a task that has a day and no start
- **THEN** the API responds 400 and the task is unchanged

#### Scenario: An end before the start

- **WHEN** a request sets a task from 12:00 to 11:00, or from 12:00 to 12:00
- **THEN** the API responds 400 and the task is unchanged

#### Scenario: Until the end of the day

- **WHEN** a member sets a task from 22:00 to 24:00
- **THEN** the task reads back as due from 22:00 to 24:00

#### Scenario: Past the end of the day

- **WHEN** a request names an end of 24:30 or 01:00 for a task starting at 23:00
- **THEN** the API responds 400 and the task is unchanged

#### Scenario: Moving the start keeps the length

- **WHEN** a member moves the start of a task due from 12:00 to 13:30 to 15:00 without naming an
  end
- **THEN** the task is due from 15:00 to 16:30

#### Scenario: Moving the start past the end of the day

- **WHEN** a member moves the start of a task due from 12:00 to 14:00 to 23:00 without naming an
  end
- **THEN** the API responds 400 and the task is unchanged

#### Scenario: Clearing the start

- **WHEN** a member clears the time of day of a task due from 12:00 to 13:00
- **THEN** the task is stored with its day, no start and no end

#### Scenario: Clearing the due date

- **WHEN** a member clears the due date of a task that had one
- **THEN** the task is stored with no due date, no time of day and no end, and keeps its column
  and position

#### Scenario: The times survive completion

- **WHEN** a member completes a task repeating weekly, due Wednesday from 12:00 to 13:00
- **THEN** it is due the next Wednesday from 12:00 to 13:00

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

The task form SHALL open showing only a title, a description, a priority and, to a member
permitted to change tasks, the task's stage. The checklist, the dates and the block that names a
project and a responsible member SHALL NOT be shown until they are asked for, unless the new task
already carries a value for them.

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
- **THEN** the title, the description, the priority and the stage are shown, the `Назначить`
  block is shown with the manager chosen as responsible and no project, and no checklist or due
  date is

#### Scenario: Saving without touching the responsible member

- **WHEN** a manager creates a task without changing who is responsible
- **THEN** the task is stored with the manager as its responsible member

#### Scenario: A new task starts bare

- **WHEN** a client opens the form to create a task
- **THEN** the title, the description and the priority are shown, and no stage, checklist, due
  date, project or responsible member is

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
- **THEN** the project says there is no work in flight rather than showing an empty table,
  unless the member may create tasks, who is offered the Новая задача tile in its place

### Requirement: The task module can be narrowed to chosen responsible members

The task module SHALL offer a filter by responsible member, choosing any number of them at
once. Choosing none SHALL mean the module shows everything it otherwise would; choosing one
or more SHALL show only the tasks those members are responsible for.

The filter SHALL list the members who are responsible for the tasks the viewer can already
see, not the organization's staff, so the list answers whose work is on this board. Each
SHALL be shown by name with their avatar. An **Не назначен** entry SHALL be offered
alongside them while a task nobody is responsible for is visible, and choosing it SHALL
include those tasks.

The filter SHALL narrow only what reach and the own-work rule already allow, and SHALL NOT
widen it: it is a reading aid, never a way to see somebody else's work.

The filter SHALL belong to the module rather than to one of its views: it SHALL narrow the
board and the calendar alike, and switching between them SHALL keep it.

#### Scenario: Narrowing to one member

- **WHEN** an admin whose board carries several members' tasks chooses one member in the
  filter
- **THEN** only the tasks that member is responsible for are shown

#### Scenario: Narrowing to several members

- **WHEN** the admin chooses a second member as well
- **THEN** the tasks of both members are shown, and no others

#### Scenario: Choosing nobody shows everything

- **WHEN** no member is chosen in the filter
- **THEN** every task the member would otherwise see is shown

#### Scenario: Unchoosing the last member

- **WHEN** the admin unchooses the only member they had chosen
- **THEN** the module shows everything again, as it did before the filter was touched

#### Scenario: The list names whose work is on the board

- **WHEN** a member opens the filter
- **THEN** it lists, each with their avatar, the members responsible for the tasks that
  member can see, and nobody else

#### Scenario: Work nobody is responsible for

- **WHEN** a task nobody is responsible for is visible and the member chooses **Не назначен**
- **THEN** the tasks with no responsible member are shown

#### Scenario: Nothing to claim

- **WHEN** every visible task has somebody responsible for it
- **THEN** the filter offers no **Не назначен** entry

#### Scenario: The filter cannot widen what is seen

- **WHEN** a manager, who sees only the tasks they are responsible for, uses the filter
- **THEN** no colleague's task appears, whatever is chosen

#### Scenario: The same filter on the calendar

- **WHEN** a member narrows the board to one responsible member and switches to the calendar
- **THEN** the calendar shows that member's tasks alone, with the filter still chosen

### Requirement: The task module remembers whose work was chosen

The chosen responsible members SHALL be remembered for the member who chose them and SHALL
survive leaving the module and reloading the app, the way the chosen view already does. Each
member SHALL have their own choice: one member's filter SHALL NOT be shown to another.

#### Scenario: The filter outlives the visit

- **WHEN** a member narrows the module to one responsible member, leaves the module and
  opens it again
- **THEN** the same member is still chosen and the module is still narrowed to their work

#### Scenario: The filter survives a reload

- **WHEN** a member narrows the module and reloads the app
- **THEN** the filter is as they left it

#### Scenario: Another member's own filter

- **WHEN** a second member opens the task module on the same browser
- **THEN** their filter is their own, unaffected by what the first member chose

### Requirement: The responsible member is picked from the agency staff

The task form's responsible-member picker SHALL offer every active admin, manager and guest
of the organization, including the member filling the form, to an admin and to a manager
alike. It SHALL NOT offer a customer or a suspended member. A task whose responsible member
is no longer offered SHALL still show that member as selected.

#### Scenario: Manager assigns a task to themselves
- **WHEN** a manager creates a task and picks themselves as responsible
- **THEN** the task is stored with the manager as its responsible member

#### Scenario: Manager assigns a task to an admin
- **WHEN** a manager opens the responsible-member picker
- **THEN** it offers themselves, the other employees and the admins of the organization

#### Scenario: Suspended members are not offered
- **WHEN** a member opens the responsible-member picker and a colleague is suspended
- **THEN** that colleague is not offered

### Requirement: A task can be raised from its project

The list of a project's work in flight SHALL offer a Новая задача tile to a member who may
create tasks, after the tasks it lists, or alone in place of the note that nothing is in
flight. It SHALL NOT be offered to anyone else. Choosing it SHALL open the task form
for a new task that already names that project and, when the member is among the
responsible members the form offers, names the member themselves as responsible; the
`Назначить` block SHALL therefore be shown from the start. Both SHALL stay changeable before
the task is saved. A task saved this way SHALL appear in the project's list while it is in
flight.

#### Scenario: Raising a task for oneself

- **WHEN** a manager chooses Новая задача under a project, enters a title and saves
- **THEN** the task is stored under that project with the manager responsible for it, and
  appears in the project's work in flight

#### Scenario: The form opens assigned

- **WHEN** a manager chooses Новая задача under a project
- **THEN** the form shows the `Назначить` block naming that project and the manager, and
  does not offer `Назначить` in the row

#### Scenario: Giving it to a colleague

- **WHEN** the manager picks a colleague as responsible before saving
- **THEN** the task is stored with the colleague responsible for it

#### Scenario: The tile follows the tasks

- **WHEN** a manager opens a project with two tasks in flight
- **THEN** the Новая задача tile comes after both tasks

#### Scenario: The tile in place of an empty list

- **WHEN** a manager opens a project with nothing in flight
- **THEN** the Новая задача tile is shown alone, without the note that nothing is in flight

#### Scenario: A member who may not create tasks

- **WHEN** a guest opens a project
- **THEN** its work in flight offers no Новая задача tile

### Requirement: A task opens from its project as it does in the task module

Choosing a task in a project's list of work in flight SHALL open it exactly as choosing it on
the task board does: in the task form, where it can be changed, saved and deleted after
confirmation, for a member who may update tasks; read-only, with no control that changes
it, for anyone else. A change saved there SHALL show in the project's list at once, and a
task deleted or moved out of the in-flight stages SHALL leave it.

#### Scenario: A manager opens a task from a project

- **WHEN** a manager chooses a task in a project's work in flight
- **THEN** the task form opens holding that task's values

#### Scenario: Saving a change

- **WHEN** the manager renames the task in that form and saves
- **THEN** the project's list shows the new title

#### Scenario: Deleting from the project

- **WHEN** the manager deletes the task from that form and confirms
- **THEN** the task is deleted and leaves the project's list

#### Scenario: A guest opens a task from a project

- **WHEN** a guest chooses a task in a project's work in flight
- **THEN** the task is shown read-only, with no control that changes it

### Requirement: A task in flight is shown as the board shows it

Each task in a project's list of work in flight SHALL be shown on the same card as on the
task board — its title, priority, due date with its time of day and a mark when it
repeats, checklist progress, attachments, project and responsible member — with its stage
added, since the list has no columns to show it, and with no control for dragging it.
Cards SHALL take the height their content needs.

#### Scenario: A task with everything

- **WHEN** a task in flight is due on 2 October at 14:00 every day, has 2 of 3 checklist
  items ticked and 2 attachments
- **THEN** its card shows 02.10 14:00 with a repeat mark, 2/3 and 2 attachments, beside its
  title, priority, stage and responsible member

#### Scenario: A bare task

- **WHEN** a task in flight has no due date, checklist or attachments
- **THEN** its card shows nothing standing in for them

#### Scenario: Nothing to drag

- **WHEN** a manager looks at a project's work in flight
- **THEN** no card offers a control for dragging it

### Requirement: A task is closed and reopened from its card

Every task card — on the board, in the calendar and in a project's list of work in flight —
SHALL carry a Готово checkbox for a member permitted to change tasks, and SHALL carry none for
anyone else. The checkbox SHALL be ticked exactly when the task is in `DONE`, SHALL expose that
state and the task's title in its accessible name, and SHALL be reachable and toggled from the
keyboard. Toggling it SHALL NOT open the task or start dragging its card.

- Ticking it on a task that does not repeat SHALL move the task to the first position of `DONE`,
  as one move that obeys every rule a dragged move does: it is atomic, renumbers both columns,
  is audited, and is refused for a member who may not change tasks.
- Unticking it on a task in `DONE` SHALL move the task to the first position of `IN_PROGRESS`
  the same way.
- Ticking it on a repeating task that is not in `DONE` SHALL complete the task into its next
  occurrence, leaving it in its column and the checkbox unticked. This SHALL be the only
  completion control a card offers.

The card SHALL be drawn in its new state immediately, without waiting for the response, and a
refused change SHALL restore it and tell the member it did not happen.

#### Scenario: Closing a task from the board

- **WHEN** a manager ticks Готово on a task sitting third in `IN_PROGRESS`
- **THEN** the task is first in `DONE` with its checkbox ticked, and the cards that were below it
  in `IN_PROGRESS` move up by one

#### Scenario: Reopening a task

- **WHEN** a manager unticks Готово on a task in `DONE`
- **THEN** the task is first in `IN_PROGRESS` with its checkbox unticked

#### Scenario: Closing a task from the calendar

- **WHEN** a manager ticks Готово on a calendar card of a task that does not repeat
- **THEN** the task is in `DONE`, stays on its day, and its checkbox is ticked

#### Scenario: Closing a task from a project

- **WHEN** a manager ticks Готово on a task in a project's list of work in flight
- **THEN** the task is in `DONE` and leaves the list

#### Scenario: Completing a weekly call

- **WHEN** a manager ticks Готово on a call repeating weekly, due Wednesday, sitting in
  `IN_PROGRESS`
- **THEN** the call is due the next Wednesday, stays where it was in `IN_PROGRESS`, and its
  checkbox is unticked

#### Scenario: A guest sees no checkbox

- **WHEN** a guest opens the board, the calendar or a project
- **THEN** no card carries a Готово checkbox

#### Scenario: The change is refused

- **WHEN** the server refuses a tick
- **THEN** the card returns to where it was with its checkbox as it was, and the member is told
  the change did not happen

#### Scenario: Ticking does not open the task

- **WHEN** a manager ticks Готово on a card
- **THEN** the task form does not open

#### Scenario: From the keyboard

- **WHEN** a manager moves focus to a card's Готово checkbox and presses Space
- **THEN** the task is closed exactly as a click would close it

#### Scenario: The move is recorded

- **WHEN** a manager closes a task with its checkbox
- **THEN** an audit event records that member, that task, and the move into `DONE`

### Requirement: The task module can be narrowed to chosen projects

The task module SHALL offer, next to the responsible-member filter, a filter by project choosing
any number of projects at once. Choosing none SHALL mean the module shows everything it otherwise
would; choosing one or more SHALL show only the tasks of those projects.

The filter SHALL list the projects of the tasks the member can already see, not every project of
the organization, so the list answers whose work is on this board. Each SHALL be shown by name
with its avatar. A Без проекта entry SHALL be offered while a task with no project is visible,
and choosing it SHALL include those tasks. A project that is chosen SHALL stay listed even when no
visible task belongs to it any more, so it can be unchosen.

The filter SHALL belong to the module rather than to one of its views: it SHALL narrow the board
and the calendar alike, and switching between them SHALL keep it. It SHALL combine with the
responsible-member filter, a task being shown only when it passes both. It SHALL narrow only what
reach and the own-work rule already allow, and SHALL NOT widen it.

The chosen projects SHALL be remembered for the member who chose them, survive leaving the module
and reloading the app, and SHALL NOT be shown to another member.

#### Scenario: Narrowing to one project

- **WHEN** a member whose board carries tasks of several projects chooses Сайт in the filter
- **THEN** only the tasks of Сайт are shown

#### Scenario: Narrowing to several projects

- **WHEN** the member chooses Магазин as well
- **THEN** the tasks of both projects are shown, and no others

#### Scenario: Choosing nothing shows everything

- **WHEN** no project is chosen in the filter
- **THEN** every task the member would otherwise see is shown

#### Scenario: The list names the projects on the board

- **WHEN** a member opens the filter
- **THEN** it lists, each with its avatar, the projects of the tasks that member can see, and
  no other project

#### Scenario: Tasks with no project

- **WHEN** a task with no project is visible and the member chooses Без проекта
- **THEN** the tasks with no project are shown

#### Scenario: Nothing without a project

- **WHEN** every visible task belongs to a project
- **THEN** the filter offers no Без проекта entry

#### Scenario: With a responsible member chosen

- **WHEN** a member chooses Сайт in the project filter and Мария in the responsible-member filter
- **THEN** only the tasks of Сайт that Мария is responsible for are shown

#### Scenario: The same filter on the calendar

- **WHEN** a member narrows the board to Сайт and switches to the calendar
- **THEN** the calendar shows the tasks of Сайт alone, with the filter still chosen

#### Scenario: The last task of a chosen project leaves

- **WHEN** the only visible task of a chosen project is deleted
- **THEN** the project is still listed and chosen, and can be unchosen

#### Scenario: The filter survives a reload

- **WHEN** a member chooses Сайт and reloads the app
- **THEN** Сайт is still chosen and the module is still narrowed to it

#### Scenario: Another member's own filter

- **WHEN** a second member opens the task module on the same browser
- **THEN** their project filter is their own, unaffected by what the first member chose

### Requirement: The task form shows and changes the task's stage

The task form's header SHALL offer, next to the priority, an Этап select to a member permitted to
change tasks, and to nobody else. It SHALL list the six stages in the board's order and SHALL show
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
- **THEN** it lists Идея, В работе, На исправление, На проверке, Готово and Архив, in the board's
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

#### Scenario: The move is refused

- **WHEN** the server refuses the move of a task whose stage was changed in its form
- **THEN** the task stays in its stage, the form stays open, and the member is told the move did
  not happen
