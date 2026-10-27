# task-calendar Specification

## Purpose

A second view of the same tasks, arranged by the day they are due rather than by the stage
they have reached, so an agency can see what a week holds and move work to another day.

## Requirements

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

### Requirement: Dragging a card to another day moves the due date

A member permitted to change tasks SHALL move a task to another day by dragging its card
into that day's column, which SHALL set the task's due date to that day and its start to where it
is dropped. A task with an end SHALL keep its length; a drop that would carry the end past
midnight SHALL place the task as late as the day allows instead. The card SHALL be drawn in its new
place immediately, without waiting for the response, and a refused move SHALL return it to
where it came from and tell the member the move did not happen.

A member not permitted to change tasks SHALL NOT be able to drag a card.

#### Scenario: Moving a call to Thursday

- **WHEN** a manager drags a task due Wednesday at 12:00 into Thursday's column at the 12:00
  line
- **THEN** the task is due Thursday at 12:00, and the card is drawn in Thursday's column
  before the server answers

#### Scenario: The length travels with the card

- **WHEN** a manager drags a task due Wednesday from 12:00 to 13:30 to the 15:00 line of Friday
- **THEN** the task is due Friday from 15:00 to 16:30

#### Scenario: Dropped too late for its length

- **WHEN** a manager drops a task lasting two hours at the 23:00 line
- **THEN** the task is due from 22:00 to 24:00, its card ending at the midnight line

#### Scenario: A refused move is undone on screen

- **WHEN** the server refuses the move
- **THEN** the card returns to where it was dragged from and the member is told the move
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

### Requirement: The hour grid can be zoomed
The calendar SHALL offer, beside Сегодня, the controls Уменьшить масштаб and Увеличить масштаб, which step the hour grid through five scales. The largest scale SHALL be the calendar's default hour height; the smallest SHALL be the height at which all 24 hours fit the calendar's visible height without scrolling, recomputed when that height changes, and never larger than the default. Each control SHALL be unavailable at its end of the range. The calendar SHALL open at the largest scale unless the signed-in person chose another scale in this browser, which SHALL be remembered for that person alone. A task card drawn too short for its full content, whether because of the scale or because the task is short, SHALL show only its title and time on one line. Placing, dragging and dropping tasks SHALL resolve times at the current scale.

#### Scenario: Zooming out to the whole day
- **WHEN** a member presses Уменьшить масштаб until it is unavailable
- **THEN** all 24 hours are visible without scrolling and Увеличить масштаб is available

#### Scenario: Back to the default
- **WHEN** a member presses Увеличить масштаб until it is unavailable
- **THEN** the grid is at its default hour height

#### Scenario: The scale is remembered
- **WHEN** a member zooms out, leaves the tasks module and returns
- **THEN** the calendar opens at the scale they chose

#### Scenario: Compact cards
- **WHEN** the grid is at its smallest scale
- **THEN** each timed task shows its title and time on one line

#### Scenario: A short task at the default scale
- **WHEN** the grid is at its default scale and a day holds a call from 10:00 to 10:15
- **THEN** the call shows its title and time on one line, and an hour-long task beside it shows
  its full card

#### Scenario: Dropping at a small scale
- **WHEN** a member drops a task at the 14:30 line of a zoomed-out grid
- **THEN** the task is rescheduled to 14:30

### Requirement: A compact calendar card tells its details on hover
When the calendar shows a task as a compact card, hovering or focusing the card SHALL show a tooltip with the task's full title, its time, its project and its participants, leaving out what the task does not have. Dragging the card SHALL NOT be prevented by the tooltip.

#### Scenario: Hovering a compact card
- **WHEN** a member hovers a compact card of the task Созвон at 10:00 on project Сайт that Мария takes part in
- **THEN** a tooltip shows Созвон, 10:00, Сайт and Мария

#### Scenario: A full-size card
- **WHEN** a member hovers a full-size card
- **THEN** no details tooltip is shown for the card

### Requirement: A timed task occupies its time, beside the tasks it overlaps

In the hour grid a task with a time of day SHALL be drawn from its start to its end, its height
following its length at the grid's current scale. A task with no end SHALL be drawn one hour
long, and never past midnight. A card that would run past the bottom of the grid, which shows
the small hours last, SHALL be cut at the bottom. Tasks with no time of day keep their place
above the grid.

Tasks of one day whose drawn times overlap SHALL be drawn side by side, dividing the day's width
between them, so that no card is drawn over another and each stays visible and can be opened and
dragged. Overlap SHALL be judged from the times as drawn, so a task ending at 13:00 and one
starting at 13:00 do not overlap. Each card SHALL keep the earliest place to the left that no
overlapping card already holds, and a day with no overlap SHALL draw every card at full width.

#### Scenario: A short call and a long workshop

- **WHEN** a day holds a call from 10:00 to 10:30 and a workshop from 14:00 to 17:00
- **THEN** the workshop's card is six times as tall as the call's, each starting at its own hour

#### Scenario: A task with no end

- **WHEN** a day holds a task at 12:00 with no end
- **THEN** its card spans 12:00 to 13:00

#### Scenario: Two tasks at the same hour

- **WHEN** a day holds two tasks from 12:00 to 13:00
- **THEN** they are drawn side by side, each half the day's width, and both can be opened

#### Scenario: A chain of overlaps

- **WHEN** a day holds tasks from 9:00 to 11:00, from 10:00 to 12:00 and from 11:00 to 13:00
- **THEN** the first and the third share one place and the second is drawn beside them, so the
  day is divided in two

#### Scenario: Back to back

- **WHEN** one task ends at 13:00 and the next starts at 13:00
- **THEN** both are drawn at full width, one above the other

#### Scenario: Late in the day

- **WHEN** a task at 23:30 has no end
- **THEN** its card ends at the midnight line, half an hour long

### Requirement: Finished tasks are not drawn in the calendar

The task calendar SHALL NOT draw a task that is done or archived. A call, which recurs whatever stage it was left in, SHALL still be drawn by the calls view. A task
closed from the calendar or elsewhere SHALL leave its day at once and SHALL come back when it
is reopened.

#### Scenario: Closing a task from the calendar

- **WHEN** a member ticks Готово on a task that does not repeat
- **THEN** its card leaves the calendar

#### Scenario: Closing a task on the board

- **WHEN** a task shown in the calendar is moved to Готово on the board
- **THEN** the calendar no longer shows it

#### Scenario: Reopening a task

- **WHEN** a done task is moved back to In progress on the board
- **THEN** it is drawn again on its day

### Requirement: A calendar card names its participants on hover

A full-size task card in the calendar SHALL show the pictures of up to three participants and,
when there are more, how many others there are; each picture SHALL show its member's name in a
tooltip when it is hovered or focused.

#### Scenario: Hovering a participant

- **WHEN** a member hovers Мария's picture on the calendar card of a task Мария takes part in
- **THEN** a tooltip reads Мария

### Requirement: The calls view shows every occurrence of each call

The `Созвоны` view SHALL be a week calendar with the same hour grid, week travel and zoom as
the task calendar, holding the calls and nothing else, whatever stage they are in. A call SHALL
be drawn on its due day and on every later day of the week shown on which it recurs, counting
from its due date by its repetition, and on no day before its due date; a call that does not
repeat SHALL be drawn on its due day alone, and a call that skips weekends SHALL NOT be drawn on an
occurrence its repetition leaves out. A monthly call due on a day a month does not have SHALL fall
on that month's last day. Each occurrence SHALL be drawn at the call's time on that day in the
call's time zone, as the reader's clock reads it, so the hour an occurrence is drawn at follows a
change of clocks in either zone. The view SHALL follow the participant and project filters of the
tasks screen.

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

#### Scenario: A one-off call

- **WHEN** a call due Tuesday 20 October at 15:00 does not repeat and the week of 19 October is
  shown
- **THEN** it is drawn at 15:00 on Tuesday alone

#### Scenario: A stand-up on weekdays

- **WHEN** a call due Monday 19 October at 10:00 repeats daily and skips weekends
- **THEN** it is drawn from Monday to Friday and not on Saturday or Sunday

#### Scenario: Across a change of clocks

- **WHEN** a call is due Monday 19 October at 10:00 in Warsaw, repeating daily, and a member in
  Minsk shows the week of 19 October
- **THEN** it is drawn at 11:00 from Monday to Saturday and at 12:00 on Sunday 25 October, when
  Warsaw has turned its clocks back

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
