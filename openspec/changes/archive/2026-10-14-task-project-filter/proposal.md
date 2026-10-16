## Why

The task module can be narrowed only to chosen responsible members. To see what is still
outstanding on one project, a member has to read the project name on every card or open the
project itself, which shows only the work in flight and not the calendar.

## What Changes

- The task module offers a filter by project next to the responsible-member filter, choosing any
  number of projects at once, with a Без проекта entry for tasks that belong to none.
- It lists the projects of the tasks the member can already see, each with its avatar, and only
  narrows what the member sees.
- It narrows the board and the calendar alike, combines with the responsible-member filter, and is
  remembered for the member who chose it, like the responsible-member filter.

## Capabilities

### New Capabilities

### Modified Capabilities
- `task-board`: the task module can be narrowed to chosen projects.

## Impact

- `apps/web/src/entities/task/lib/`: a helper listing the projects of the visible tasks and
  narrowing tasks to the chosen ones, beside the responsible-member helpers.
- `apps/web/src/pages/tasks/TasksPage.tsx`: the second filter in the header.
- `apps/web/src/shared/lib/moduleMemory.ts`: the remembered choice per user.
- `apps/web/src/shared/config/ru.ts`: the filter's copy.
- No API change: the board already loads every visible task with its project.
