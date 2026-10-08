## Why

At small scales the calendar shows each task as a one-line card with its title and time; the
project and assignee disappear, and a long title is cut short.

## What Changes

- Hovering or focusing a compact calendar card shows a tooltip with the task's title, time,
  project and assignee.
- Full-size cards are unchanged; their assignee picture keeps its own name tooltip.

## Capabilities

### Modified Capabilities
- `task-calendar`: a compact card tells its details on hover.

## Impact

- **Web** (`apps/web`): `widgets/task-calendar/TaskCalendar.tsx` and its test.
