## MODIFIED Requirements

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
