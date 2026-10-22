## Why

When a buyer shows a client their figures, the client often has several projects. Leaving
preview to pick another project brings the navigation and the editing controls back on the
shared screen.

## What Changes

- In preview a bar at the top holds, on the left, a select of the projects of the shown project's
  client and, on the right, «Выйти из превью».
- Choosing a project opens it in preview with the same period.
- Preview applies only to project pages: an address naming preview elsewhere shows the page as
  usual.

## Capabilities

### New Capabilities

### Modified Capabilities
- `project-preview`: the preview bar with the client's projects; preview only on project pages.

## Impact

- `apps/web`: the preview bar on the projects page, the app shell no longer draws the exit
  button. No API change.
