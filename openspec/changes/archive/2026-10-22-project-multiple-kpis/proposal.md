## Why

A project is judged by more than one figure at once: leads, cost per lead and spend, say. It
can hold a single KPI today, so a media buyer has to choose one goal and lose the others.

## What Changes

- A project can hold several KPIs, up to five. The organization and a campaign still hold
  one each.
- The KPI dialog of a project lists its KPIs as blocks, each with its own metric, target and
  an on/off switch, and always ends with one empty block for adding the next.
- A switched-off KPI stays in the list and on its tile but no longer counts toward the
  project's result.
- The project's page shows one KPI tile per KPI.
- A project's result, which colours it in the project list, fills the dashboard's gauge and
  Выполнение KPI column and decides when the KPI-met notification is sent, is that of its
  least-met enabled KPI. A project with no enabled KPI is unrated.
- **BREAKING (API)**: the project KPI is read and written as a list at `/api/projects/:id/kpis`
  instead of one object at `/api/projects/:id/kpi`, and the projects summary carries `kpis`
  instead of `kpi`.

## Capabilities

### New Capabilities

### Modified Capabilities
- `kpi-targets`: a project holds several KPIs that can be switched off.

## Impact

- `apps/api`: a project KPI table replacing the project's KPI columns, the KPI module's
  routes and use cases, the campaign summary, the KPI-met notification, OpenAPI.
- `apps/web`: the KPI entity, tile, dialog, project tone, dashboard table, gauge and trend,
  the campaign indicator.
