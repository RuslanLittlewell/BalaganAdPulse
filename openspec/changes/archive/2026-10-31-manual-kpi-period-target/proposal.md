## Why

A KPI set by hand compares its value with its target as entered, whatever the period, so a
monthly sales target of 50 stays 50 on a week's summary while every measured monthly KPI is
recalculated for the period. Members expect the target set by hand to follow the period too.

## What Changes

- The target of a KPI set by hand is a target for a month, recalculated for the selected
  period day by day, as the targets of monthly metrics are.
- Its value still changes only by hand.
- The KPI dialog says so instead of saying that neither depends on the period.
- The server's check that every KPI of a project is met this month, which sends the KPI
  notification, recalculates the target the same way.

## Capabilities

### New Capabilities

### Modified Capabilities
- `kpi-targets`: a KPI set by hand recalculates its target for the period.

## Impact

- `apps/web/src/entities/kpi/model/progress.ts` and `apps/api/src/modules/kpi/domain/progress.ts`:
  the progress of a KPI set by hand.
- `apps/web/src/shared/config/ru.ts`: the dialog's hint.
