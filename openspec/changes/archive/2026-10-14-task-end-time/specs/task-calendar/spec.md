## ADDED Requirements

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

## MODIFIED Requirements

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
