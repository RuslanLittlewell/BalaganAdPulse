## MODIFIED Requirements

### Requirement: The tasks screen offers a board and a calendar

The tasks screen SHALL offer three views of the same tasks — `Канбан`, `Календарь` and
`Созвоны` — chosen from a tab list. Exactly one SHALL be shown at a time, and the view being
left SHALL fade out as the view being entered fades in, rather than appearing abruptly. The
tabs SHALL be reachable and switchable from the keyboard, and each SHALL expose whether it is
the selected one.

The chosen view SHALL be remembered for that person in that browser and SHALL be the view
they return to. A person who has never chosen SHALL see the board.

#### Scenario: Switching to the calendar

- **WHEN** a member selects `Календарь`
- **THEN** the board is replaced by the calendar, and the calendar is marked as the selected
  tab

#### Scenario: Switching to the calls

- **WHEN** a member selects `Созвоны`
- **THEN** the calls calendar is shown, and `Созвоны` is marked as the selected tab

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

### Requirement: The calendar shows only tasks that have a due date

A task SHALL appear in the calendar exactly on its due day, and only if it has a due date. A
task without one SHALL NOT appear in any day — it is found on the board. A call SHALL NOT
appear in the calendar at all — it is found in `Созвоны`.

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

#### Scenario: A call is not in the calendar

- **WHEN** a call is due today at 10:00
- **THEN** today's column of the calendar does not hold it

## ADDED Requirements

### Requirement: The calls view shows every occurrence of each call

The `Созвоны` view SHALL be a week calendar with the same hour grid, week travel and zoom as
the task calendar, holding the calls and nothing else, whatever stage they are in. A call SHALL
be drawn on its due day and on every later day of the week shown on which it recurs, counting
from its due date by its repetition, and on no day before its due date. A monthly call due on
a day a month does not have SHALL fall on that month's last day. The view SHALL follow the
participant and project filters of the tasks screen.

The card on a call's due day SHALL be dragged to another day and time as a task card in the
calendar is, moving the call as a whole. A card on a day the call only recurs on SHALL open the
call when clicked and SHALL NOT be dragged. No card of a call SHALL offer the `Готово` tick.

#### Scenario: A daily stand-up

- **WHEN** a call due Monday 19 October at 10:00 repeats daily and the week of 19 October is
  shown
- **THEN** it is drawn at 10:00 on each of the seven days

#### Scenario: A fortnightly call

- **WHEN** a call due Wednesday 14 October repeats every two weeks
- **THEN** it is drawn on Wednesday 28 October and not on Wednesday 21 October

#### Scenario: Not before it starts

- **WHEN** a call due Thursday 22 October repeats daily and the week of 19 October is shown
- **THEN** it is drawn from Thursday to Sunday and not on Monday to Wednesday

#### Scenario: A day the call recurs on

- **WHEN** a member clicks the Friday card of a daily call due on Monday
- **THEN** the call opens, and that card could not have been dragged

#### Scenario: Only calls

- **WHEN** a weekly task at 12:00 is not marked as a call
- **THEN** it is not in the calls view, and is on the board and in the calendar

### Requirement: Today's column marks the current time

The task calendar and the calls view SHALL draw a line across today's column at the current
time of day in the interface's primary colour, and SHALL move it as time passes. No other
column SHALL carry the line, and a week that does not hold today SHALL show none.

#### Scenario: Looking at today

- **WHEN** a member opens the calendar on Tuesday 20 October at 14:32
- **THEN** a line is drawn across Tuesday's column at 14:32, and on no other day

#### Scenario: Another week

- **WHEN** the member moves to the next week
- **THEN** no current-time line is drawn
