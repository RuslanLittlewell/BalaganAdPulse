## Why

A project's KPI can only be one of the advertising metrics the platform measures. Many
goals a media buyer agrees with a client are not among them — sales closed, calls taken,
visits to a showroom — and today such a project shows no KPI at all, so its tile is empty
and its marker in the project list stays grey.

## What Changes

- The KPI dialog of a project offers a further choice beside the metrics, **Вручную**.
  Choosing it shows three fields — **Название**, **Значение** and **Цель** — instead of the
  target alone.
- A KPI set by hand is the project's one KPI, like any other: setting it replaces a metric
  KPI and the other way round. Its value changes only when someone edits it; imports and
  the selected period never touch it.
- Progress is the value over the target, higher being better. The KPI tile shows the name,
  the value, the target and the percentage, and the project's marker in the list follows
  it in the same zones.
- A project KPI set by hand does not stand in for a campaign without its own KPI.
- The API accepts `{ metric: "MANUAL", name, value, target }` on a project's KPI, returns it
  in the same shape, and carries `name` and `value` in the projects summary; the
  organization and campaigns refuse it with 400.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `kpi-targets`: a project can hold a KPI set by hand.
- `campaign-metrics`: the projects summary carries the name and value of a KPI set by hand.

## Impact

- Prisma: `MANUAL` added to the `kpi_metric` enum; `project` gains `kpi_name` and
  `kpi_value`. Existing KPIs are unchanged.
- API: `modules/kpi` (domain, schemas, use cases, repository, OpenAPI) and
  `modules/campaigns` (project reach adapter, projects summary, OpenAPI).
- Web: `entities/kpi` (types, progress), `features/kpi-target` (dialog, tile, formatting),
  `pages/project/campaignTone.ts`, `widgets/project-list/projectTone.ts`,
  `entities/campaign` (projects summary type), copy in `ru.ts`.
