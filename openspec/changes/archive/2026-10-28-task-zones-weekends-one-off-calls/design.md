## Context

A task stores its day as a calendar date and its times as `HH:MM` strings with no zone. The API
reads them in one configured zone, `TASK_TIME_ZONE` (Europe/Minsk), for the deadline reminder and
the Telegram bot; the web app shows them as they are and takes "today" and the current-time line
from the browser's clock. A member outside Minsk therefore reads every time an hour or more off,
against a clock line that is right for them.

A call is a task with `isCall`, allowed only with a time and a repetition. The calls view draws a
call on its due day and on each day it recurs, at the call's own `dueTime`. Repetition is plain
date arithmetic (`nextOccurrence`, `occurrencesBetween`), duplicated in the API and the web.

## Goals / Non-Goals

**Goals:**
- Every member reads a task's day and times in their own time zone, and the deadline reminder fires
  at the right instant.
- A one-off call.
- A repeating task that leaves out Saturdays and Sundays.

**Non-Goals:**
- A time zone chosen in the profile; the browser's zone is the member's zone.
- Holidays or a configurable working week.
- Converting a task with a day and no time: a date is the same date everywhere.

## Decisions

- **A task carries the zone it was set in.** `task.time_zone` holds an IANA name, nullable; null
  reads as `TASK_TIME_ZONE`, so existing tasks and tasks from the Telegram bot keep their meaning
  without a backfill that would have to guess the configured zone in SQL. The repository resolves
  the null when it reads a row, so every task the API returns, over HTTP and over the realtime
  socket, names a zone. A zone is accepted when `Intl.DateTimeFormat` knows it. Storing a UTC
  instant instead was rejected: a repeating task keeps its wall-clock time in its own zone across
  a change of clocks, which an instant cannot say.
- **The web converts at the API boundary.** `tasksApi` and the realtime handler turn each task's
  day and times into the viewer's zone before they reach the cache, and keep `timeZone` as the zone
  the task is stored in. The board, the calendar, the cards and the form keep working on plain
  local days and times. Any write that carries a day or a time adds the viewer's zone, so what the
  member entered is what is stored. An optimistic update writes local values and the viewer's zone,
  which is what the API will answer.
- **An untouched schedule is not sent.** The edit form leaves the day and times out of the update
  when they equal the task's, so renaming a task does not move it into the editor's zone; for a
  repeating task in a zone with different clock changes that would shift later occurrences by an
  hour.
- **Occurrences are counted in the task's zone.** The calls view derives each occurrence from the
  task's stored day and time (the local values converted back into `timeZone`), steps the
  repetition in that zone, leaves out weekends there, and converts each occurrence to the viewer's
  zone on its own. A call's due date only moves when it is dragged, so taking the local time of the
  due date for every occurrence would be an hour off for half of the year.
- **Weekends are skipped, not moved.** The user chose to leave out an occurrence that falls on a
  weekend rather than move it, which needs no anchor date and never drifts: completing steps the
  repetition until it reaches a weekday, at most twelve steps (twelve months always hold the day on
  a weekday). Only a weekly or fortnightly repetition from a Saturday or a Sunday never reaches a
  weekday; the task then moves to the following Monday, which is what skipping weekends asks for.
  A due date on a weekend is normalised on every save that leaves the task skipping weekends.
- **The reminder window widens by a day.** Due tasks are looked up from yesterday to the day after
  tomorrow in the agency's zone and then filtered by their own deadline, so a task whose date
  differs across zones is not missed; the claim per deadline keeps it to one notice.

## Risks / Trade-offs

- [A local time in the viewer's zone that the clocks skip or repeat converts back ambiguously] →
  it can only happen for an occurrence within the hour of a change of clocks, and the stored task
  is unaffected.
- [A task that ends after the reader's midnight is shown ending at 24:00] → dragging it there may
  be refused for running past the end of its day; rare between neighbouring zones.
- [A member whose browser reports a wrong zone sets times in it] → the zone is the operating
  system's; the times read back the same to that member, and others see the instant they meant.
