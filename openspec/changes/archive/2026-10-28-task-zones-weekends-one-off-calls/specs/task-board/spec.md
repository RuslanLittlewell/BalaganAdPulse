## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: A repeating task with a time may be marked as a call

**Reason**: A call no longer needs a repetition; a one-off call with a client is a call too.

**Migration**: Replaced by "A task with a time may be marked as a call". Every existing call has a
time and keeps being a call.

## ADDED Requirements

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
