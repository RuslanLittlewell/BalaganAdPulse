## Why

Some projects have no goal worth following: a house account, a test project, a client who buys
without a target. They sit on the dashboard as projects without a KPI, warn about it and drag the
count of projects meeting their KPI. Today the only way to quiet them is to invent a KPI.

## What Changes

- Every project carries a switch, Отслеживать KPI, on in the project's header, on unless turned
  off.
- A project left out of tracking keeps its KPIs and still shows them on its own page, but is
  otherwise treated as having none: it is not counted by the dashboard's gauge, not listed as a
  project without a KPI, shows no progress in the dashboard table or a grey mark in the project
  list, and sends no KPI-met notification.
- Only members who may change KPIs see the switch active; others see its state.

## Capabilities

### New Capabilities

### Modified Capabilities
- `kpi-targets`: a project can be left out of KPI tracking.

## Impact

- `apps/api`: a `kpi_tracked` column on the project, the project's DTO and update, the projects
  summary and the KPI-met notification.
- `apps/web`: the project header, the dashboard standings and its notices.
