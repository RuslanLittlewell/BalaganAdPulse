## Why

The project list's priority filter is rarely what a member wants: with many projects they
look for one by name. A search field finds a project faster than narrowing by priority,
and each row already shows its priority marker.

## What Changes

- The priority filter select above the project list is removed.
- A search field takes its place. It narrows the list, pinned projects and groups to the
  projects whose name or client name contains the typed text, ignoring case and
  surrounding spaces, after the member pauses typing.
- While a search is active the list cannot be rearranged by dragging, as it could not
  under a priority filter; groups with no match are hidden; a search with no match says so.
- Priority markers and the priority context menu are unchanged.

## Capabilities

### New Capabilities

### Modified Capabilities
- `project-list-layout`: the list is narrowed by a search instead of a priority filter.

## Impact

- `apps/web/src/widgets/project-list/ProjectList.tsx`.
- A debounced-value hook in `apps/web/src/shared/lib`.
- `apps/web/src/shared/config/ru.ts` — search copy; the filter copy is dropped.
- No API change.
