## Why

Recurring calls with clients and the team live on the board as repeating tasks, mixed with
the work. The calendar shows each of them only on the day it is next due, so a daily stand-up
appears once a week and a week's meetings can't be seen at a glance. Nor does the calendar
show where in the day "now" is. And a task's images can only be pasted or dropped into the
description; there is no button to pick a file, although the images spec has always asked for
one.

## What Changes

- A task with a time of day and a repetition may be marked **Созвон**. The task form, creating
  or editing, offers the switch only once both are set; a call that loses its time or its
  repetition stops being a call.
- The tasks screen gets a third view, **Созвоны**: a week calendar of the calls only, each
  drawn on every day it recurs, from its due date on — a daily call on every day. It follows
  the participant and project filters of the screen. The card on a call's due day is dragged as
  before; the others open the call.
- Calls leave **Канбан** and **Календарь**: they are found in **Созвоны** alone.
- The calendars with an hour grid (the task calendar and the calls view) draw a line across
  today's column at the current time in the primary colour — green in the light theme, gold
  in the dark — moving as time passes.
- The attachments of a task get a paperclip button that opens a file picker; the chosen
  images are uploaded and added to the end of the description, as a pasted image would be.
- API: a task carries `isCall`, set on create and update.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `task-board`: a task may be marked as a call, and a call is not on the board.
- `task-calendar`: the calls view, calls leaving the calendar, and the current-time line.
- `task-images`: images are also attached from a file picker beside the attachments.

## Impact

- Prisma: `task.is_call`, a boolean defaulting to false. Existing tasks are not calls.
- API: `modules/tasks` (the schedule rule, schemas, repository, OpenAPI).
- Web: `entities/task` (the field, occurrences of a repeating task in a week, the upload
  limits), `features/task-management` (the switch, the paperclip), `widgets/task-calendar`
  (call occurrences and the now line), `pages/tasks` (the third tab).
