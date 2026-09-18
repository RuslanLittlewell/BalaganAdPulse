## Purpose

A second view of the same tasks, arranged by the day they are due rather than by the stage
they have reached, so an agency can see what a week holds and move work to another day.

## ADDED Requirements

### Requirement: The tasks screen offers a board and a calendar

The tasks screen SHALL offer two views of the same tasks — `Канбан` and `Календарь` —
chosen from a tab list. Exactly one SHALL be shown at a time, and the view being left SHALL
fade out as the view being entered fades in, rather than appearing abruptly. The tabs SHALL
be reachable and switchable from the keyboard, and each SHALL expose whether it is the
selected one.

The chosen view SHALL be remembered for that person in that browser and SHALL be the view
they return to. A person who has never chosen SHALL see the board.

#### Scenario: Switching to the calendar

- **WHEN** a member selects `Календарь`
- **THEN** the board is replaced by the calendar, and the calendar is marked as the selected
  tab

#### Scenario: The choice outlives the session

- **WHEN** a member who last used the calendar reloads the tasks screen
- **THEN** the calendar is shown

#### Scenario: A first visit

- **WHEN** a member opens the tasks screen having never chosen a view
- **THEN** the board is shown

#### Scenario: Another person on the same browser

- **WHEN** a different person signs in on the same browser
- **THEN** their own remembered view is used, and the board if they have none

#### Scenario: Reached from the keyboard

- **WHEN** a member moves focus to the tab list and selects the other tab with the keyboard
- **THEN** the other view is shown, exactly as clicking it would

### Requirement: The calendar shows one week at a time

The calendar SHALL show seven day columns, Monday to Sunday, of a single week. It SHALL
name the week being shown and mark today's column when today falls in it. It SHALL offer
moving to the previous week, to the next week, and back to the week that holds today, with
no limit on how far a member may travel in either direction.

The calendar SHALL open on the week that holds today.

#### Scenario: Opening the calendar

- **WHEN** a member opens the calendar on Thursday 17 September
- **THEN** the week of Monday 14 to Sunday 20 September is shown, with Thursday marked as
  today

#### Scenario: Travelling to the next week

- **WHEN** a member moves to the next week
- **THEN** the seven days of that week are shown, no day is marked as today, and the week is
  named

#### Scenario: Coming back to today

- **WHEN** a member three weeks ahead chooses to return to the current week
- **THEN** the week holding today is shown again

### Requirement: The calendar shows only tasks that have a due date

A task SHALL appear in the calendar exactly on its due day, and only if it has a due date. A
task without one SHALL NOT appear in any day — it is found on the board.

Within a day, tasks with a time of day SHALL be shown first, earliest first, followed by
tasks with no time. A card SHALL show its time when it has one, its priority, its
responsible member and its checklist progress when it has a checklist, and SHALL be marked
when the task repeats.

A day with no tasks SHALL still be drawn, empty, in its place in the week.

#### Scenario: A task with no due date

- **WHEN** a member opens the calendar while a task without a due date sits in
  `IN_PROGRESS`
- **THEN** that task is in no day of the calendar, and is still on the board

#### Scenario: Order within a day

- **WHEN** a day holds a task due at 15:00, a task due at 12:00 and a task due that day with
  no time
- **THEN** they are shown in that day as 12:00, 15:00, then the one with no time

#### Scenario: An empty day

- **WHEN** no task is due on Sunday of the week being shown
- **THEN** Sunday's column is drawn, empty, after Saturday

#### Scenario: A repeating task is marked

- **WHEN** a day holds a task that repeats weekly
- **THEN** its card is marked as repeating

### Requirement: Dragging a card to another day moves the due date

A member permitted to change tasks SHALL move a task to another day by dragging its card
into that day's column, which SHALL set the task's due date to that day and keep its time of
day. The card SHALL be drawn in its new day immediately, without waiting for the response,
and a refused move SHALL return it to the day it came from and tell the member the move did
not happen.

A member not permitted to change tasks SHALL NOT be able to drag a card.

#### Scenario: Moving a call to Thursday

- **WHEN** a manager drags a task due Wednesday at 12:00 into Thursday's column
- **THEN** the task is due Thursday at 12:00, and the card is drawn in Thursday's column
  before the server answers

#### Scenario: A refused move is undone on screen

- **WHEN** the server refuses the move
- **THEN** the card returns to the day it was dragged from and the member is told the move
  did not happen

#### Scenario: A guest cannot drag

- **WHEN** a guest opens the calendar
- **THEN** no card can be dragged and no day accepts one

### Requirement: The calendar shows the same tasks as the board

The calendar SHALL show exactly the tasks the member reaches, by the same rules as the
board, and SHALL reflect a change made elsewhere — by another member, or by the member
themselves on the board — as the board does, without a manual reload. A task completed,
edited or deleted while the calendar is open SHALL leave the day it was in and appear in the
day it belongs to.

#### Scenario: Reach is the same

- **WHEN** a manager granted two of the organization's ten clients opens the calendar
- **THEN** only tasks belonging to projects of those two clients appear

#### Scenario: A change made by someone else

- **WHEN** another member moves a task to Friday while the calendar is open on that week
- **THEN** the card appears in Friday's column without the member reloading

#### Scenario: Completing a weekly call from the calendar

- **WHEN** a member completes a task that repeats weekly, due this Wednesday
- **THEN** the card leaves this Wednesday and is found on Wednesday of the next week
