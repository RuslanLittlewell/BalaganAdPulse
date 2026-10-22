## Why

The projects list tells a media buyer at a glance which project is on plan (green), a little
behind (yellow) or far behind (red). The dashboard does not: its monthly KPI gauge lumps
every project behind plan into one red group, and its project table carries no sign of KPI
progress and cannot be ordered by it.

## What Changes

- The monthly KPI gauge on the dashboard splits the projects behind plan into those a little
  behind (yellow) and those far behind (red), with the same 70% and 90% limits as the
  projects list.
- Each project row in the dashboard table carries the KPI colour mark beside its name.
- The dashboard table gains a Выполнение KPI column with the project's progress in percent,
  shown by default and sortable like any other column.

## Capabilities

### New Capabilities

### Modified Capabilities
- `kpi-targets`: the dashboard gauge and project table show KPI progress in the same zones as the project list.

## Impact

- `apps/web/src/widgets/agency-overview`, `apps/web/src/widgets/performance-table`,
  `apps/web/src/shared/config/ru.ts`.
- No API change.
