## Why

On a phone the task module's header holds the participant and project filters, the view tabs
and the create button in one row; the two filters take most of it. They are set now and then,
not read all the time, so they can wait behind a button.

## What Changes

- Below 768 px the participant and project filters move behind a button with a filter icon,
  which opens them in a popover; the button shows how many choices are active.
- From 768 px the filters stay inline as they are.
- The archive, which shares the filters, gets the same button.

## Capabilities

### New Capabilities

### Modified Capabilities
- `mobile-layout`: the task filters sit behind a button on a narrow screen.

## Impact

- `apps/web/src/widgets/task-filters/TaskFilters.tsx`: the button, its popover and the inline row
  from `md`.
- `apps/web/src/shared/config/ru.ts`: the button's name.
