## Why

The "Показатели за период" summary shows the same five tiles on the dashboard, the project page and the campaign page, whatever a member actually tracks. Buyers usually judge a period by one or two figures against a goal, and today there is no goal anywhere in the product to judge against.

## What Changes

- Each summary starts with a single "Лиды" tile, followed by a placeholder of the same size with a thick dashed border and a "+" in the middle.
- The placeholder opens a dialog with thumbnails of the available tiles. Members pick up to five, the dialog shows the count as `2/5`, and selected thumbnails have a highlighted border.
- Available tiles are the current five (Расход, Показы, Клики, Лиды, CPC) plus a new KPI tile.
- The choice is kept per person and per screen (dashboard, project page, campaign page) and survives reload.
- New KPI targets: one each for the organization, for every project and for every campaign. A KPI is a metric with a target and is stored on the server.
- Targets for summable metrics (spend, impressions, reach, clicks, leads, revenue) are monthly and are prorated to the selected reporting period. Targets for ratios (CTR, CPC, CPM, CPL, ROAS, frequency) apply as they are.
- The KPI tile shows the actual figure against its target, with progress and whether it is met. It knows which ratios are better lower.
- Staff set project and campaign KPIs. Admins set the organization KPI. Everyone who reaches a project or campaign can read its KPI.
- No **BREAKING** changes: new endpoints and nullable columns only.

## Capabilities

### New Capabilities
- `summary-tiles`: the configurable period summary — default tile, placeholder, selection dialog, limit, per-person per-screen memory.
- `kpi-targets`: organization, project and campaign KPI targets — metrics, monthly proration, direction, permissions, audit and the KPI tile.

### Modified Capabilities

None.

## Impact

- Prisma: nullable `kpi_metric`, `kpi_target` and `kpi_updated_at` on `organization`, `project` and `campaign`, plus a `kpi_metric` enum. The migration is additive.
- Backend: a `kpi` module with read, set and clear endpoints for each level, access checks through the shared policy, audit events and OpenAPI.
- Frontend: a KPI entity (API, queries and the progress calculation), a persisted tile layout store, the summary placeholder and selection dialog, the KPI tile and target dialog, and wiring on the dashboard, project and campaign pages. Russian copy goes in `ru.ts`.
