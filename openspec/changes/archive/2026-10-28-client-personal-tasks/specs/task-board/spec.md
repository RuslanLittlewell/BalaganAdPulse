## MODIFIED Requirements

### Requirement: A task is either the agency's own or shared with the client

Every task SHALL record whether it is visible to the client. A task is the agency's own
by default: work the agency does about a customer is not addressed to them.

- A task raised by a `CLIENT` or `CLIENT_ADMIN` on a project SHALL be marked visible to the
  client when it is created. They raised it; it is theirs to see.
- A task raised by a `CLIENT` or `CLIENT_ADMIN` with no project SHALL be stored as their
  personal task: not marked visible to the client, and seen by its author alone.
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

#### Scenario: A client raises a task without a project

- **WHEN** a client creates a task naming no project
- **THEN** it is stored as their personal task, not marked visible to the client, and
  appears on their board as Без проекта

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

### Requirement: A task with no project is reached by the members it belongs to

A task with no project SHALL be reached by the member who created it, by every member taking
part in it, and by every `ADMIN` of its organization. No other member SHALL reach
it, and to them it SHALL answer 404 rather than 403.

A customer's personal task — one a `CLIENT` or `CLIENT_ADMIN` raised with no project — SHALL
be reached by its author alone: not by an `ADMIN`, not by a manager, and not by the other
people of the same client. To everybody else it SHALL answer 404. A customer SHALL NOT reach
any other task with no project, whatever it is marked, because such a task concerns no
client.

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
- **THEN** every task of the organization is shown, including those with no project, except
  the personal tasks of customers

#### Scenario: A client never sees it

- **WHEN** a member with the `CLIENT` role opens their board
- **THEN** no task without a project is shown except the personal tasks they raised

#### Scenario: A client's personal task

- **WHEN** a client raises a task with no project
- **THEN** it is on their board and calendar, and opening its address answers 404 to an admin,
  to a manager and to the client's other people

#### Scenario: Nobody else hears of it

- **WHEN** a client's personal task is created, changed or deleted, or its deadline draws near
- **THEN** only its author's open sessions receive the event, and only its author is
  notified

### Requirement: The board shows the work the member takes part in

What a member sees on the board SHALL be narrowed by whose work it is, not only by which
projects they reach:

- An `ADMIN` SHALL see every task in the organization except a customer's personal task.
- A `MANAGER` or `GUEST` SHALL see the tasks they take part in, and the tasks nobody takes part
  in that they created. A task nobody takes part in is otherwise seen by admins alone.
- A `CLIENT` or `CLIENT_ADMIN` SHALL see only the tasks marked visible to the client, on
  the projects they reach, and the personal tasks they raised themselves. The two customer
  roles see the same work on projects: the second administers people, not tasks. Being
  named as a participant SHALL NOT widen what a customer sees.

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
- **THEN** every task in the organization is shown, whoever takes part, except the personal
  tasks of customers

#### Scenario: A client's employee sees what the client sees

- **WHEN** a `CLIENT` and the `CLIENT_ADMIN` of the same client each open the task module
- **THEN** both see every task marked visible to the client on their projects, including
  the ones the other raised

#### Scenario: A colleague's personal task stays theirs

- **WHEN** the `CLIENT_ADMIN` of a client opens the task module after a `CLIENT` of the same
  client raised a personal task
- **THEN** that task is not shown, and its address answers 404

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

### Requirement: Only admins and managers change tasks

Creating, updating, moving, completing and deleting a task, and every change to its
checklist, SHALL be permitted to `ADMIN` and `MANAGER` only, with one exception: a customer
SHALL change, move, complete and delete their own personal task, as a manager may, keep it
without a project, and name nobody on it. A `GUEST` SHALL read the board
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

#### Scenario: A client changes their personal task

- **WHEN** a client renames, reschedules, moves to `DONE` or deletes a personal task they raised
- **THEN** the change is stored, and the board's editing controls are offered to them on that
  task alone

#### Scenario: A client gives their personal task a project

- **WHEN** a client sets a project on a personal task
- **THEN** the API responds 400 and the task is unchanged

#### Scenario: Client-role member opens the board
- **WHEN** a member with the `CLIENT` role requests the board or any task
- **THEN** the API responds 403 and no task is returned

### Requirement: Every task mutation is audited

Creating, updating, moving, completing and deleting a task, and every change to its
checklist, SHALL each write an audit event in the same transaction as the mutation, naming
the member who made the change. A customer's personal task SHALL write none: the activity
log is read by the agency, and the task is its author's alone.

#### Scenario: A move is recorded
- **WHEN** a manager drags a task from `IN_PROGRESS` to `DONE`
- **THEN** an audit event records that member, that task, and the column it moved between

#### Scenario: A completion is recorded
- **WHEN** a manager completes a repeating task
- **THEN** an audit event records that member, that task, and the due date it moved between

#### Scenario: A personal task leaves no trace in the log

- **WHEN** a client creates, changes and deletes a personal task
- **THEN** no audit event is written, and the agency's activity log shows nothing of it

#### Scenario: A failed mutation writes no audit event
- **WHEN** a task update is refused
- **THEN** no audit event is written for it

### Requirement: The task form shows and changes the task's stage

The task form's header SHALL offer, next to the priority, an Этап select to a member permitted to
change the task. A client opening a task they may not change SHALL see the select showing its
stage, disabled. A client raising a task SHALL be offered none. It SHALL list the six stages in the board's order and SHALL show
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

#### Scenario: A client reads the stage of a task on a project

- **WHEN** a client opens a task on a project
- **THEN** Этап shows its stage and cannot be changed

#### Scenario: The move is refused

- **WHEN** the server refuses the move of a task whose stage was changed in its form
- **THEN** the task stays in its stage, the form stays open, and the member is told the move did
  not happen

## ADDED Requirements

### Requirement: A client opens a task in the agency's form

A `CLIENT` or `CLIENT_ADMIN` opening a task SHALL see the same task form an admin sees — its
title, stage, priority, description, checklist, dates, project, attachments and comments —
without the Видно клиенту switch and without the participants, which a customer never names.

On a task on a project, which a customer may not change, every field SHALL be shown and none
SHALL be changeable: no control adds or removes a block, edits the description or removes an
attachment, and the form offers no save or delete, only a way to close it. Commenting SHALL stay
as it is.

On their own personal task the form SHALL be editable as it is for a manager, with a way to
delete the task. While a client chooses no project, the form SHALL say that a task without a
project is seen by them alone.

#### Scenario: A client opens a task on a project
- **WHEN** a client opens a task the agency shared with them
- **THEN** the form shows its title, stage and priority, none can be changed, there is no
  Видно клиенту switch, no Сохранить and no Удалить, and Закрыть closes it

#### Scenario: A client opens their personal task
- **WHEN** a client opens a personal task they raised, renames it and saves
- **THEN** the change is stored, and the form offered Удалить

#### Scenario: A client raises a task with no project
- **WHEN** a client opens the form to raise a task and chooses no project
- **THEN** the form says Задачу без проекта видите только вы

#### Scenario: Closing a personal task from its card
- **WHEN** a client ticks Готово on the card of their personal task
- **THEN** the task moves to `DONE`, while the cards of tasks on projects carry no Готово for them
