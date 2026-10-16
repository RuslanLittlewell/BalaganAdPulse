## Why

A task can be given a day and a time of day, but not how long it lasts. The calendar therefore
draws every timed task with the same height, whatever its length, and two tasks at the same
hour are drawn on top of each other, so one hides the other. A half-hour call and a three-hour
workshop look alike, and a busy morning cannot be read.

## What Changes

- A task with a time of day may also carry the time it ends, on the same day and later than it
  starts. The form's dates block asks for Начало and Окончание.
- Wherever a task's time is shown, its end is shown with it, as 12:00–13:00.
- Moving a task's start without naming a new end keeps its length; dragging a card in the calendar
  therefore keeps its length, and clearing the start clears the end.
- In the calendar a timed task occupies its time in the hour grid, from its start to its end; a
  task with no end is drawn one hour long. Tasks whose times overlap are drawn side by side,
  sharing the day's width, instead of on top of each other.
- A card too short for its full content shows its title and time on one line, whether it is short
  because of the grid's scale or because the task is short.
- Completing a repeating task keeps both its start and its end.

## Capabilities

### New Capabilities

### Modified Capabilities
- `task-board`: a task's due date carries an optional end time.
- `task-calendar`: timed tasks occupy their time and overlapping ones sit side by side; dragging
  keeps a task's length; compact cards follow a card's own height.

## Impact

- `apps/api/prisma/models/`: `Task.endTime`; one migration.
- `apps/api/src/modules/tasks/domain/schedule.ts`: the end in the schedule, keeping the length when
  only the start moves; validation in the use cases; `endTime` in the schemas and OpenAPI.
- `apps/web/src/entities/task/`: the task type and API calls.
- `apps/web/src/features/task-management/ui/TaskSchedule.tsx`, `TaskCardView.tsx`: the end in the
  form and on the card.
- `apps/web/src/widgets/task-calendar/`: card height from the task's length, the side-by-side layout
  of overlapping tasks, dropping with the length kept.
- `GET /api/tasks` and `GET /api/tasks/:id` gain `endTime`; create and update accept it. Existing
  clients ignore it.
