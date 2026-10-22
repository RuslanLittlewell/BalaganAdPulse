## Why

A media buyer shows a project's results to the client on a shared screen. The project page also
carries the navigation, other projects, integrations, tasks and editing controls, which the client
should not see and which take the room the figures need.

## What Changes

- A «Превью» button beside the project's metrics turns on a preview mode.
- In preview only the metrics are shown, across the whole width: the period controls, the summary
  tiles with the KPIs, the account tabs, the running-only switch and the campaign table.
- The navigation, the header, the project list, the project header and tabs, the integrations
  and the tasks are hidden, and so are the controls that change tiles and KPIs.
- The mode lives in the address (`?preview=1`): it survives a reload, follows into an opened
  campaign and back, and the browser's back button leaves it.
- A «Выйти из превью» button leaves the mode.

## Capabilities

### New Capabilities
- `project-preview`: showing a project's metrics alone for a client.

### Modified Capabilities

## Impact

- `apps/web`: app shell, projects page, project page; a shared preview-mode hook. No API change.
