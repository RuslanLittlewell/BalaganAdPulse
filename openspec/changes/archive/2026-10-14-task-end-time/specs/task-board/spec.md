## MODIFIED Requirements

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
