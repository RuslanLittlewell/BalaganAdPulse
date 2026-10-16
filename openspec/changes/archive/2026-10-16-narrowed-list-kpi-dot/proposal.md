## Why

The narrowed project list shows each project's picture alone, so the KPI marker that the
wide list paints beside every project disappears the moment the list is narrowed. A member
who keeps the list narrow loses the at-a-glance reading of which projects need attention.

## What Changes

- In the narrowed list, each project's picture carries a small circle in its KPI marker's
  colour — grey, red, yellow or green, as the wide list's bar.
- The narrowed picture describes the marker's state to assistive technology, as the wide
  row names it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-list-layout`: the KPI marker is shown in the narrowed list too, as a small circle
  on the picture.

## Impact

- Web: `widgets/project-list/ProjectItem.tsx` only. No API, schema or copy change.
