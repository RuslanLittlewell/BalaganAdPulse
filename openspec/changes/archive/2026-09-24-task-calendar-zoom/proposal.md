## Why

The task calendar's hour grid is fixed at a height that shows about ten hours at once, so
seeing a whole day means scrolling. Planning a week needs the whole day in view; placing a task
precisely needs the current, roomy grid.

## What Changes

- Beside Сегодня, two controls — Уменьшить масштаб and Увеличить масштаб — step the hour grid
  through five scales. The largest is today's grid; the smallest fits all 24 hours in the
  calendar's visible height without scrolling, recomputed when the window is resized.
- The chosen scale is remembered per person in this browser, like the task view.
- At small scales task cards are compact: title and time on one line, without the checklist,
  attachments or footer, so they stay within their hour.
- Hovering the assignee's picture on a calendar card shows their name in a tooltip.
- Dragging and dropping work at every scale; a drop resolves to the time under the card at the
  current scale.

## Capabilities

### Modified Capabilities
- `task-calendar`: a zoomable hour grid; the assignee named on hover.

## Impact

- **Web** (`apps/web`): `widgets/task-calendar`, `shared/lib/moduleMemory.ts`, `ru.ts` and tests.
  No API change.
