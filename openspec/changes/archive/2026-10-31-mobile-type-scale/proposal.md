## Why

On a phone the app's text keeps its desktop sizes, so less fits on the narrow screen than the
layout now allows.

## What Changes

- Below 768 px every step of the type scale and its line height is 0.85 of its desktop size,
  body text included; from 768 px nothing changes.
- The 11 px labels written as fixed sizes become a step of the scale, `text-2xs`, and shrink with
  it.
- Labels already set at 8–10 px keep their size, so no text drops below 8 px.

## Capabilities

### New Capabilities

### Modified Capabilities
- `mobile-layout`: text is set smaller on a narrow screen.

## Impact

- `apps/web/src/shared/styles/tokens.css`: the scale factor and the scaled type steps.
- The components using `text-[11px]`: task cards, participants, the task calendar, lead cards
  and sources, project groups, the activity log, the navigation and the task filter badge.
