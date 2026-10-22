## Why

The dashboard project table draws a small chart of each project's daily spend beside its name.
Spend alone says little about whether a project is heading for its plan; the figure a media
buyer follows is progress against the KPI.

## What Changes

- The mini chart beside each project's name in the dashboard table shows how the project's
  KPI progress developed over the selected period, instead of its daily spend.
- A project without a KPI that is measured by its figures, such as one with no KPI or one
  with a KPI set by hand, shows no chart.

## Capabilities

### New Capabilities

### Modified Capabilities
- `kpi-targets`: the dashboard project table charts KPI progress.

## Impact

- `apps/web/src/widgets/agency-overview`, `apps/web/src/entities/campaign/model/total.ts`,
  `apps/web/src/shared/config/ru.ts`.
- No API change.
