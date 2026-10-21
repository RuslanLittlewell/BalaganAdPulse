## Why

The agreed reading of plan completion changed: a project or campaign is on plan from 90% of its
KPI, a middling result starts at 70%, and anything below is a failure. The 80% and 100%
boundaries of the traffic light no longer match it.

## What Changes

- Green zone: progress of 90% or more.
- Yellow zone: from 70% up to 90%.
- Red zone: below 70%.
- This applies to a campaign's indicator and a project's marker alike, and so to the dashboard
  gauge, which counts a project as meeting its KPI exactly when its marker is green.
- The "KPI achieved" notification keeps its own rule (the plan reached, 100%).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `kpi-targets`: the zones of a campaign's indicator.
- `project-list-layout`: the zones of a project's marker.

## Impact

- Web: `pages/project/campaignTone.ts`, `widgets/project-list/projectTone.ts`.
- No API, schema or copy change except the tone legend text, which names no percentage.
