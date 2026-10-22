## Why

A project with two advertising accounts shows its campaigns one account at a time. Opening a
campaign and coming back drops the member on the first account again, so they must choose
their account every time.

## What Changes

- The account a member chose on a project is remembered for that project and chosen again when
  they return to it, from a campaign or from anywhere else, on the same device.
- When the remembered account is no longer among the project's accounts, the first account is
  chosen.

## Capabilities

### New Capabilities

### Modified Capabilities
- `meta-project-integration`: the chosen account is remembered per project.

## Impact

- `apps/web/src/entities/project`, `apps/web/src/pages/project/ProjectPage.tsx`.
- No API change.
