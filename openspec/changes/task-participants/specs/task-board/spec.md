## ADDED Requirements

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

## MODIFIED Requirements

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


## REMOVED Requirements

### Requirement: A task carries a title, description, priority and responsible member

**Reason**: A task no longer has one responsible member; it names any number of participants.
**Migration**: See "A task carries a title, description, priority and participants" and "A
task names its participants". A task's former responsible member becomes one of its
participants.

### Requirement: The responsible member is an active member of the organization

**Reason**: Replaced by the rules for who may be named as a participant.
**Migration**: See "A task names its participants".

### Requirement: The board shows the work that is the member's own

**Reason**: The rule is restated in terms of participants rather than a responsible member.
**Migration**: See "The board shows the work the member takes part in".

### Requirement: A task is composed from the blocks of content it is given

**Reason**: The `Назначить` block now carries participants instead of a responsible member.
**Migration**: See "The task form is composed from the blocks a task needs".

### Requirement: The task module can be narrowed to chosen responsible members

**Reason**: The filter narrows by participant now that there is no responsible member.
**Migration**: See "The task module can be narrowed to chosen participants".

### Requirement: The responsible member is picked from the agency staff

**Reason**: Replaced by the participants picker.
**Migration**: See "Participants are picked from those who may be named".

### Requirement: The task module can be narrowed to chosen projects

**Reason**: Restated beside the participant filter rather than the responsible-member filter.
**Migration**: See "Tasks can be narrowed to chosen projects".
