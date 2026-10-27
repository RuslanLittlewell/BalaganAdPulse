## Why

The agency's people do not all sit in one time zone, yet a task's time is read as the agency's
wall clock for everyone: a call at 10:00 in Minsk reads 10:00 to a member in Warsaw, who joins an
hour early, and the calendar's line for the current time disagrees with the tasks around it.
A one-off call with a client cannot be marked as a call, because only a repeating task may be.
And a daily task lands on Saturday and Sunday, when nobody works.

## What Changes

- A task carries the time zone its day and time were set in. The web app shows every task's day
  and time in the reader's own time zone and sends the reader's zone with every day or time it
  sets; tasks set without one, such as those created from Telegram, read in the agency's time
  zone, Europe/Minsk unless configured otherwise.
- The deadline reminder is counted in the task's own time zone; a notification names its task's
  zone, and the bell shows the deadline in the reader's.
- A task with a day and a time may be marked as a call whether or not it repeats; a one-off call
  is drawn in `Созвоны` on its day only.
- A repeating task may skip weekends: a `Пропускать выходные` checkbox in the task form. Its
  occurrences on Saturday and Sunday are left out: completing it moves it to the next occurrence
  on a weekday, a due date on a weekend moves to the first occurrence on a weekday, and the calls
  view does not draw it on weekends.
- API: a task carries `timeZone` and `skipWeekends`, both accepted on create and update.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `task-board`: a task's time zone and how its day and time are shown; a call no longer needs a
  repetition; a repeating task may skip weekends.
- `task-calendar`: the calls view draws each occurrence at its own time in the reader's zone,
  skips weekends for a call that skips them, and draws a one-off call on its day.
- `notifications`: the deadline of a task is read in the task's time zone, a notification names
  its task's zone, and the bell shows the deadline in the reader's.

## Impact

- Prisma: `task.time_zone`, nullable, and `task.skip_weekends`, defaulting to false. Existing
  tasks keep reading in the agency's time zone and do not skip weekends.
- API: `modules/tasks` (schedule rules, schemas, repository, OpenAPI) and `modules/notifications`
  (the deadline's zone, the task's zone in a notification).
- Web: `entities/task` (conversion between zones at the API boundary, occurrences, weekends),
  `features/task-management` (the checkbox, the call switch, keeping the zone of an unchanged
  schedule), `widgets/task-calendar` (occurrences at their own time), `widgets/notification-center`
  (the deadline in the reader's zone).
