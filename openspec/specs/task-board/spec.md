# task-board Specification

## Purpose
A task is a unit of work under a project, shown as a card on a Kanban board. The board is
where the agency sees what is being worked on, who is responsible for it, how urgent it is,
and which stage it has reached.

## Requirements

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

Marking a task visible SHALL NOT change who takes part in it or which stage it is at.

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
its start on the same day, at the latest 24:00, the end of that day.

A task SHALL carry the time zone its day and times are read in: the zone named by the request
that last set its day or time, or, for a task whose schedule was set without one, such as a task
created from Telegram, the agency's time zone, Europe/Minsk unless the API is configured with
another. A zone SHALL be named by its IANA name, and a request naming an unknown zone SHALL be
refused. The web app SHALL name the reader's own time zone with every day or time it sets, and
SHALL show every task's day and times in the reader's time zone, on the board's cards, in the
calendar, in the calls view and in the task form, so a task due at 10:00 in Minsk reads 09:00 to
a member in Warsaw in summer, on the day it falls on there. A task with a day and no time SHALL
read as the same calendar day for every member. Saving a task whose day and times the member did
not change SHALL keep its time zone. A task that, for the reader, would end after their day ends
SHALL be shown ending at 24:00.

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

- **WHEN** a task due on 25 September with no time is read by a member whose machine is three
  hours behind the agency
- **THEN** the task is still due on 25 September

#### Scenario: Read in another time zone

- **WHEN** a member in Minsk sets a task due 25 September from 10:00 to 11:00 and a member in
  Warsaw opens it
- **THEN** the member in Warsaw sees it due 25 September from 09:00 to 10:00, and the member in
  Minsk still sees 10:00 to 11:00

#### Scenario: Another day for the reader

- **WHEN** a task is due 26 September at 00:30 in Minsk and a member in Warsaw opens the calendar
- **THEN** the task is drawn on 25 September at 23:30

#### Scenario: Set from another time zone

- **WHEN** a member in Warsaw sets a task due 25 September at 09:00
- **THEN** the task reads back due 25 September at 09:00 in Europe/Warsaw, and a member in Minsk
  sees it at 10:00

#### Scenario: Only the title changes

- **WHEN** a member in Warsaw renames a task due at 10:00 in Minsk and saves it
- **THEN** the task is still due at 10:00 in Europe/Minsk

#### Scenario: A task without a time zone

- **WHEN** a task due 25 September at 12:00 is created from Telegram
- **THEN** it reads back due at 12:00 in Europe/Minsk

#### Scenario: An unknown time zone

- **WHEN** a request sets a task's due time naming the time zone Mars/Olympus
- **THEN** the API responds 400 and the task is unchanged

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
be created, and the task SHALL keep its title, description, priority, participants,
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

A task with no project SHALL be reached by the member who created it, by every member taking
part in it, and by every `ADMIN` of its organization. No other member SHALL reach
it, and to them it SHALL answer 404 rather than 403.

A `CLIENT` SHALL NOT reach a task with no project at all, whatever it is marked, because
such a task concerns no client.

#### Scenario: The member who wrote it

- **WHEN** a manager creates a task with no project and opens the board
- **THEN** the task is there, even though nobody takes part in it

#### Scenario: The member it was given to

- **WHEN** an admin creates a task with no project and names a manager on it
- **THEN** that manager sees it on their board

#### Scenario: A colleague

- **WHEN** another manager, who neither wrote it nor takes part in it, requests that task by
  id
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

### Requirement: The task module remembers whose work was chosen

The chosen participants SHALL be remembered for the member who chose them and SHALL
survive leaving the module and reloading the app, the way the chosen view already does. Each
member SHALL have their own choice: one member's filter SHALL NOT be shown to another.

#### Scenario: The filter outlives the visit

- **WHEN** a member narrows the module to one participant, leaves the module and
  opens it again
- **THEN** the same member is still chosen and the module is still narrowed to their work

#### Scenario: The filter survives a reload

- **WHEN** a member narrows the module and reloads the app
- **THEN** the filter is as they left it

#### Scenario: Another member's own filter

- **WHEN** a second member opens the task module on the same browser
- **THEN** their filter is their own, unaffected by what the first member chose

### Requirement: A task can be raised from its project

The list of a project's work in flight SHALL offer a Новая задача tile to a member who may
create tasks, after the tasks it lists, or alone in place of the note that nothing is in
flight. It SHALL NOT be offered to anyone else. Choosing it SHALL open the task form
for a new task that already names that project and, when the member is among the
people the form offers, names the member themselves as a participant; the
`Назначить` block SHALL therefore be shown from the start. Both SHALL stay changeable before
the task is saved. A task saved this way SHALL appear in the project's list while it is in
flight.

#### Scenario: Raising a task for oneself

- **WHEN** a manager chooses Новая задача under a project, enters a title and saves
- **THEN** the task is stored under that project with the manager taking part in it, and
  appears in the project's work in flight

#### Scenario: The form opens assigned

- **WHEN** a manager chooses Новая задача under a project
- **THEN** the form shows the `Назначить` block naming that project and the manager, and
  does not offer `Назначить` in the row

#### Scenario: Giving it to a colleague

- **WHEN** the manager names a colleague and takes themselves out before saving
- **THEN** the task is stored with the colleague as its only participant

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
repeats, checklist progress, attachments, project and participants — with its stage
added, since the list has no columns to show it, and with no control for dragging it.
Cards SHALL take the height their content needs.

#### Scenario: A task with everything

- **WHEN** a task in flight is due on 2 October at 14:00 every day, has 2 of 3 checklist
  items ticked and 2 attachments
- **THEN** its card shows 02.10 14:00 with a repeat mark, 2/3 and 2 attachments, beside its
  title, priority, stage and participants

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

### Requirement: The participant and project filters offer a Все entry

The participant filter and the project filter of the tasks screen SHALL each list a **Все**
entry above their other entries. Choosing it SHALL choose every entry of that filter at once;
choosing it while every entry is chosen SHALL clear the filter. It SHALL be marked chosen
exactly while every entry of its own filter is chosen, and unmarked otherwise. The entry of
one filter SHALL NOT change the choice of the other.

#### Scenario: Choosing every participant at once

- **WHEN** a member opens the participant filter with nobody chosen and chooses **Все**
- **THEN** every participant listed, including **Без участников** when offered, is chosen

#### Scenario: Choosing every project at once

- **WHEN** a member opens the project filter with one project chosen and chooses **Все**
- **THEN** every project listed, including **Без проекта** when offered, is chosen

#### Scenario: Clearing through Все

- **WHEN** every entry of a filter is chosen and the member chooses **Все**
- **THEN** nothing is chosen in that filter

#### Scenario: Все follows the entries

- **WHEN** every entry of a filter is chosen one by one
- **THEN** **Все** is marked, and unchoosing any entry unmarks it

#### Scenario: The two filters are independent

- **WHEN** a member chooses **Все** in the participant filter
- **THEN** the project filter keeps whatever was chosen in it

### Requirement: A task carries a title, description, priority and participants

A task SHALL carry a non-empty title and a priority of `LOW`, `MEDIUM`, `HIGH` or `URGENT`.
It SHALL optionally carry a rich-text description and any number of participants. The
description SHALL round-trip unchanged, including references to the images embedded in it.

#### Scenario: Creating a task with only the required fields

- **WHEN** a member creates a task through the API with a title, a project and a priority
- **THEN** the task is stored with an empty description and no participants

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

### Requirement: A task names its participants

A task SHALL name any number of members as its participants — Участники; there is no separate
responsible member. The list SHALL be given whole when the task is
created or updated: a request naming no list SHALL leave it as it is, and a request naming an
empty list SHALL clear it. A member SHALL be named at most once; a request breaking that rule
SHALL be refused as a whole.

Each member newly named SHALL be an active member of the task's organization; a member already
named who has since been suspended MAY stay. An agency member — an `ADMIN`, `MANAGER` or
`GUEST` — SHALL be allowed on any task. A customer — a `CLIENT` or `CLIENT_ADMIN` — SHALL be
allowed only on a task that belongs to a project, and only while they reach that project; a
request naming a customer otherwise, or moving a task to a project a named customer does not
reach, SHALL be refused. A customer named on a task SHALL see it only when it is marked visible
to the client.

Only an `ADMIN` or a `MANAGER` SHALL name participants. Being named SHALL NOT grant any right to
change the task. A member removed from the organization SHALL leave every list they were named
in, and the task SHALL survive.

A task that had a responsible member before participants existed SHALL carry that member as a
participant.

#### Scenario: Three people on a weekly call

- **WHEN** a manager creates a task repeating weekly at 12:00, naming themselves, a colleague
  and a guest
- **THEN** the task reads back with those three participants

#### Scenario: Several people on a task

- **WHEN** an admin names two managers on a task
- **THEN** the task reads back with both as its participants

#### Scenario: Leaving the list alone

- **WHEN** a manager updates a task's title naming no participants
- **THEN** the task keeps every participant it had

#### Scenario: Clearing the list

- **WHEN** a manager updates a task naming an empty list of participants
- **THEN** the task has no participants

#### Scenario: Naming somebody twice

- **WHEN** a request names the same member twice
- **THEN** the API responds 400 and the task is unchanged

#### Scenario: A member of another organization

- **WHEN** a request names a membership of another organization as a participant
- **THEN** the API responds 400 and the task is unchanged

#### Scenario: A suspended member

- **WHEN** a request newly names a suspended member
- **THEN** the API responds 400 and the task is unchanged

#### Scenario: The client's person on a task

- **WHEN** a manager names, as a participant of a task on project Сайт, a client's person who
  reaches Сайт
- **THEN** the task reads back with them among its participants

#### Scenario: A customer on a task with no project

- **WHEN** a request names a client's person as a participant of a task that has no project
- **THEN** the API responds 400 and the task is unchanged

#### Scenario: Moving a task away from its client

- **WHEN** a manager moves a task that names a client's person to a project of another client
- **THEN** the API responds 400 and the task keeps its project and its participants

#### Scenario: A guest is named but cannot edit

- **WHEN** a guest named as a participant of a task tries to change it
- **THEN** the API responds 403 and the task is unchanged

#### Scenario: A customer raising a task names nobody

- **WHEN** a client creates a task naming participants
- **THEN** the API responds 403 and no task is stored

#### Scenario: A named member leaves the organization

- **WHEN** an admin removes a member who is a participant of two tasks
- **THEN** both tasks remain, without that member among their participants

#### Scenario: A task given to somebody before

- **WHEN** the board is read after this change is deployed
- **THEN** every task that had a responsible member carries that member as a participant

### Requirement: Participants are picked from those who may be named

The `Назначить` block SHALL carry, beside the project, a picker labelled Участники choosing any
number of members at once. It SHALL offer every active admin, manager and guest of the
organization, including the member filling the form, and, on a task that names a project, every
active client's person who reaches that project, with a note that they see the task only when it
is visible to the client. A named member who is no longer offered SHALL still be shown as named.

Removing the `Назначить` block SHALL clear the participants along with the project. Changing a
task's project SHALL take out of the list every client's person who does not reach the new
project.

#### Scenario: The picker on a task with a project

- **WHEN** a manager opens the participants picker of a task on project Сайт
- **THEN** it offers the agency's staff, the manager included, and the client's people who
  reach Сайт

#### Scenario: The picker on a task with no project

- **WHEN** a manager opens the participants picker of a task with no project
- **THEN** it offers the agency's staff and no client's person

#### Scenario: Suspended members are not offered

- **WHEN** a member opens the picker and a colleague is suspended
- **THEN** that colleague is not offered

#### Scenario: Another client's project

- **WHEN** a manager changes a task naming a client's person to a project of another client
- **THEN** that person is taken out of the participants before the task is saved

### Requirement: A card shows who takes part

A task card — on the board and in a project's list of work in flight — SHALL show the pictures of
up to three participants and, when there are more, how many others there are, each picture
naming its member. A task with no participants SHALL say so.

#### Scenario: Two participants

- **WHEN** a task's participants are Мария and Пётр
- **THEN** its card shows both pictures, named Мария and Пётр

#### Scenario: Five participants

- **WHEN** a task has five participants
- **THEN** its card shows three pictures and +2

#### Scenario: Nobody takes part

- **WHEN** a task has no participants
- **THEN** its card says nobody is named

### Requirement: The board shows the work the member takes part in

What a member sees on the board SHALL be narrowed by whose work it is, not only by which
projects they reach:

- An `ADMIN` SHALL see every task in the organization.
- A `MANAGER` or `GUEST` SHALL see the tasks they take part in, and the tasks nobody takes part
  in that they created. A task nobody takes part in is otherwise seen by admins alone.
- A `CLIENT` or `CLIENT_ADMIN` SHALL see only the tasks marked visible to the client, on
  the projects they reach. The two customer roles see the same work: the second
  administers people, not tasks. Being named as a participant SHALL NOT widen what a
  customer sees.

Reach still applies first and independently: a task in a project a member cannot reach is
never shown, whoever takes part in it. This rule narrows what remains; it can never widen it.

A task a member cannot see SHALL be answered as not found, never as forbidden, so the
board cannot be used to learn that somebody else's work exists.

#### Scenario: A manager's board

- **WHEN** a manager opens the board on a project they are granted
- **THEN** the tasks they take part in are shown, and a colleague's are not

#### Scenario: A participant's board

- **WHEN** a manager named on a task a colleague created opens the board and the calendar
- **THEN** the task is shown in both, and opening it by its address shows it

#### Scenario: Taken off the list

- **WHEN** a manager is taken out of a task's participants
- **THEN** the task leaves their board and calendar, and its address answers 404

#### Scenario: A participant hears about changes

- **WHEN** another participant moves a task to another day while a participant has the
  calendar open
- **THEN** the participant's calendar shows the task on the new day without reloading

#### Scenario: Named on a project they cannot reach

- **WHEN** a manager is named on a task on a project they hold no grant for
- **THEN** the task is not on their board

#### Scenario: A task nobody takes part in

- **WHEN** a task on a granted project has no participants
- **THEN** the manager or guest who created it sees it, no other manager or guest does, and
  every admin does

#### Scenario: Creating a task for a colleague

- **WHEN** a manager creates a task naming only a colleague
- **THEN** it is on the colleague's board and not on the manager's

#### Scenario: An admin's board

- **WHEN** an admin opens the board
- **THEN** every task in the organization is shown, whoever takes part

#### Scenario: A client's employee sees what the client sees

- **WHEN** a `CLIENT` and the `CLIENT_ADMIN` of the same client each open the task module
- **THEN** both see every task marked visible to the client on their projects, including
  the ones the other raised

#### Scenario: Neither sees the agency's own work

- **WHEN** either opens the address of an unmarked task on their own project
- **THEN** the answer is 404

#### Scenario: A client's person on an unmarked task

- **WHEN** a client's person named on a task that is not marked visible to the client opens
  its address
- **THEN** the answer is 404

#### Scenario: Opening somebody else's task directly

- **WHEN** a manager opens the address of a task only a colleague takes part in
- **THEN** the answer is 404, the same answer a task that does not exist gets

#### Scenario: The lists beside the figures follow the same rule

- **WHEN** a member opens a project's screen
- **THEN** the tasks listed there are the ones their board would show, on the same rule

### Requirement: The task form is composed from the blocks a task needs

The task form SHALL open showing only a title, a description, a priority and, to a member
permitted to change tasks, the task's stage. The checklist, the dates and the block that names
a project and the participants SHALL NOT be shown until they are asked for, unless the new task
already carries a value for them.

A new task SHALL start with the member filling in the form among its participants whenever the
participants picker offers them, alongside any member the form was opened for. The `Назначить`
block is then shown from the start with them named, and they MAY name others, take themselves
out or remove the block before saving. A member the picker does not offer, such as a customer,
SHALL start with nobody named.

A row of controls under the title SHALL offer each block a task does not yet show —
`Чек-лист`, `Даты` and `Назначить`. Choosing one SHALL show that block and SHALL take it out
of the row, so a block is never offered twice. A block whose task already carries a value
SHALL be shown from the start and SHALL NOT be offered in the row.

Shown blocks SHALL appear under the description in one fixed order, whatever order they were
added in: the checklist, then the dates, then `Назначить`. `Назначить` SHALL carry the project
and the participants together, because they answer one question: whose work it is.

Each block SHALL be separated from what precedes it by a horizontal line and SHALL carry its
remove control at its right edge. Removing a block SHALL clear everything it held, so what
the form shows and what the task carries never disagree. Attachments SHALL keep their own
place and SHALL NOT be part of the row.

Whether the task is visible to the client SHALL NOT be a block: it belongs in the dialog's
footer, next to the controls that act on the task as a whole.

#### Scenario: A new task starts with its creator taking part

- **WHEN** a manager opens the form to create a task
- **THEN** the title, the description, the priority and the stage are shown, the `Назначить`
  block is shown with the manager among the participants and no project, and no checklist or
  due date is

#### Scenario: Saving without touching the participants

- **WHEN** a manager creates a task without changing the participants
- **THEN** the task is stored with the manager as its participant

#### Scenario: A new task starts bare

- **WHEN** a client opens the form to create a task
- **THEN** the title, the description and the priority are shown, and no stage, checklist, due
  date, project or participant is

#### Scenario: Adding a block

- **WHEN** a member chooses `Чек-лист` from the row
- **THEN** the checklist block appears and `Чек-лист` is no longer offered in the row

#### Scenario: One block for whose work it is

- **WHEN** a member chooses `Назначить` from the row
- **THEN** the project and the participants appear together in one block

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

#### Scenario: Taking everybody out

- **WHEN** a member takes every participant out inside the `Назначить` block and saves
- **THEN** the task is stored with no participants, and the block stays because it still
  names a project

#### Scenario: Removing the block that names a project

- **WHEN** a member removes the `Назначить` block from a task that has a project and two
  participants, and saves
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

### Requirement: The task module can be narrowed to chosen participants

The task module SHALL offer a filter by participant, choosing any number of members at once.
Choosing none SHALL mean the module shows everything it otherwise would; choosing one or more
SHALL show only the tasks at least one of them takes part in.

The filter SHALL list the members taking part in the tasks the viewer can already see, not the
organization's staff, so the list answers whose work is on this board. Each SHALL be shown by
name with their avatar. A Без участников entry SHALL be offered alongside them while a task
nobody takes part in is visible, and choosing it SHALL include those tasks.

The filter SHALL narrow only what reach and the own-work rule already allow, and SHALL NOT
widen it: it is a reading aid, never a way to see somebody else's work.

The filter SHALL belong to the module rather than to one of its views: it SHALL narrow the
board and the calendar alike, and switching between them SHALL keep it.

#### Scenario: Narrowing to one member

- **WHEN** an admin whose board carries several members' tasks chooses one member in the
  filter
- **THEN** only the tasks that member takes part in are shown

#### Scenario: Narrowing to several members

- **WHEN** the admin chooses a second member as well
- **THEN** the tasks either member takes part in are shown, and no others

#### Scenario: Choosing nobody shows everything

- **WHEN** no member is chosen in the filter
- **THEN** every task the member would otherwise see is shown

#### Scenario: The list names whose work is on the board

- **WHEN** a member opens the filter
- **THEN** it lists, each with their avatar, the members taking part in the tasks that member
  can see, and nobody else

#### Scenario: Work nobody takes part in

- **WHEN** a task with no participants is visible and the member chooses Без участников
- **THEN** the tasks with no participants are shown

#### Scenario: The filter cannot widen what is seen

- **WHEN** a manager, who sees only the tasks they take part in, uses the filter
- **THEN** no task they do not take part in appears, whatever is chosen

#### Scenario: The same filter on the calendar

- **WHEN** a member narrows the board to one participant and switches to the calendar
- **THEN** the calendar shows that member's tasks alone, with the filter still chosen

### Requirement: Tasks can be narrowed to chosen projects

The task module SHALL offer, next to the participant filter, a filter by project choosing any
number of projects at once. Choosing none SHALL mean the module shows everything it otherwise
would; choosing one or more SHALL show only the tasks of those projects. It SHALL list the
projects of the tasks the member can already see, each by name with its avatar, with a Без
проекта entry while a task with no project is visible. A project that is chosen SHALL stay listed
even when no visible task belongs to it any more, so it can be unchosen.

The filter SHALL belong to the module rather than to one of its views: it SHALL narrow the board
and the calendar alike, and switching between them SHALL keep it. It SHALL combine with the
participant filter, a task being shown only when it passes both, and SHALL narrow only what reach
and the own-work rule already allow. The choice SHALL be remembered for the member who made it,
survive leaving the module and reloading the app, and SHALL NOT be shown to another member.

#### Scenario: Narrowing to one project

- **WHEN** a member whose board carries tasks of several projects chooses Сайт in the filter
- **THEN** only the tasks of Сайт are shown

#### Scenario: Narrowing to several projects

- **WHEN** the member chooses Магазин as well
- **THEN** the tasks of both projects are shown, and no others

#### Scenario: The list names the projects on the board

- **WHEN** a member opens the project filter
- **THEN** it lists, each with its avatar, the projects of the tasks that member can see, and
  no other project

#### Scenario: Tasks with no project

- **WHEN** a task with no project is visible and the member chooses Без проекта
- **THEN** the tasks with no project are shown

#### Scenario: The last task of a chosen project leaves

- **WHEN** the only visible task of a chosen project is deleted
- **THEN** the project is still listed and chosen, and can be unchosen

#### Scenario: With a participant chosen

- **WHEN** a member chooses Сайт in the project filter and Мария in the participant filter
- **THEN** only the tasks of Сайт that Мария takes part in are shown

#### Scenario: The same filter on the calendar

- **WHEN** a member narrows the board to Сайт and switches to the calendar
- **THEN** the calendar shows the tasks of Сайт alone, with the filter still chosen

#### Scenario: The filter survives a reload

- **WHEN** a member chooses Сайт and reloads the app
- **THEN** Сайт is still chosen and the module is still narrowed to it

#### Scenario: Another member's own filter

- **WHEN** a second member opens the task module on the same browser
- **THEN** their project filter is their own, unaffected by what the first member chose

### Requirement: A task with a time may be marked as a call

A task SHALL carry whether it is a call, defaulting to not. Only a task with a due date and a time
of day SHALL be a call, whether it repeats or not: a request marking any other task as a call
SHALL be refused. A change that takes the time of day away from a call SHALL leave the task no
longer a call rather than be refused; stopping its repetition SHALL leave it a call.

The task form, when creating a task and when editing one, SHALL offer a `Созвон` switch once
the task has a time of day, and SHALL NOT offer it otherwise.

A call SHALL NOT be shown on the board, whatever stage it is in: it is found in the `Созвоны`
view of the tasks screen. A card that shows a call elsewhere SHALL mark it as a call.

#### Scenario: Marking a weekly meeting as a call

- **WHEN** a member creates a task due Monday at 10:00, repeating weekly, marked as a call
- **THEN** the task reads back as a call

#### Scenario: A one-off call

- **WHEN** a member creates a task due Monday at 10:00 that does not repeat, marked as a call
- **THEN** the task reads back as a call

#### Scenario: A call without a time

- **WHEN** a member marks as a call a task due Monday with no time
- **THEN** the API responds 400 and the task is not a call

#### Scenario: Clearing the time of a call

- **WHEN** a member clears the time of day of a call
- **THEN** the task keeps its day and is no longer a call

#### Scenario: Stopping the repetition of a call

- **WHEN** a member sets the repetition of a call to `NONE`
- **THEN** the task no longer repeats and is still a call

#### Scenario: The form offers the choice when it applies

- **WHEN** a member gives a task a day and a time in the task form
- **THEN** the switch `Созвон` appears without the task repeating, and disappears again when the
  time is cleared

#### Scenario: A call is not on the board

- **WHEN** a member opens the board while a call sits in `IDEA`
- **THEN** the call is in no column, and is found in `Созвоны`

### Requirement: A repeating task may skip weekends

A task SHALL carry whether it skips weekends, defaulting to not. Only a repeating task SHALL skip
weekends: a request asking a task that does not repeat to skip them SHALL be refused, and setting
a task's repetition to `NONE` SHALL stop the skipping.

While a task skips weekends, every occurrence of its repetition that falls on a Saturday or a
Sunday, in the task's time zone, SHALL be left out. Completing the task SHALL move its due date to
the next occurrence on a weekday, counted from its due date as before. Saving the task with a due
date on a Saturday or a Sunday SHALL move the due date to its first occurrence on a weekday; a
weekly or fortnightly task, whose occurrences all fall on that weekend day, SHALL move to the
following Monday instead. The time of day SHALL stay as it was.

The task form SHALL offer a `Пропускать выходные` checkbox while the task repeats, and SHALL NOT
offer it otherwise.

#### Scenario: Weekdays only

- **WHEN** a task repeating daily and skipping weekends, due Friday 23 October at 10:00, is
  completed
- **THEN** it becomes due Monday 26 October at 10:00

#### Scenario: A monthly day on a weekend

- **WHEN** a task repeating monthly and skipping weekends, due Thursday 15 October, is completed
- **THEN** it becomes due Tuesday 15 December, since 15 November is a Sunday

#### Scenario: Saved on a Saturday

- **WHEN** a member saves a task due Saturday 24 October, repeating daily and skipping weekends
- **THEN** it reads back due Monday 26 October

#### Scenario: A weekly day on a weekend

- **WHEN** a member saves a task due Sunday 25 October, repeating weekly and skipping weekends
- **THEN** it reads back due Monday 26 October, and is due on Mondays from then on

#### Scenario: Not without a repetition

- **WHEN** a request asks a task that does not repeat to skip weekends
- **THEN** the API responds 400 and the task is unchanged

#### Scenario: Stopping the repetition

- **WHEN** a member sets the repetition of a task that skips weekends to `NONE`
- **THEN** the task no longer repeats and no longer skips weekends

#### Scenario: The form offers the checkbox while the task repeats

- **WHEN** a member gives a task a daily repetition in the task form
- **THEN** the checkbox `Пропускать выходные` appears, and disappears again when the repetition is
  set back to `Не повторяется`
