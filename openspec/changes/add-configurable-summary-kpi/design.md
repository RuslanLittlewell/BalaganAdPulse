## Context

See proposal.md for motivation and the specs for behaviour.

- `PerformanceSummary` in `widgets/agency-overview` renders five fixed `MetricCard`s from a `Performance` object. The dashboard, project page and campaign page all render it; the pages already know the reporting range through `usePeriod`.
- The agency summary sums only the projects a member reaches, so it covers the whole organization for admins alone.
- The shared policy lets STAFF update projects and campaigns and ADMINS update the organization. Every role reads projects and campaigns it reaches.
- The API is hexagonal. Each module has domain, application, infrastructure and presentation layers, wired in `create-container.ts`, with audit through `AuditWriter` in the same unit of work.
- Web state persists through zustand `persist` (`columnWidths`, `moduleMemory`), keyed by user id where it is personal.

## Goals / Non-Goals

**Goals:** a server-stored KPI per organization, project and campaign; a configurable summary per person and screen; KPI progress computed from figures the pages already load.

**Non-Goals:**
- several KPIs per level;
- KPI history or trends;
- currency conversion for money targets;
- notifications when a KPI is missed;
- reordering tiles by drag;
- sharing tile layouts between people.

## Decisions

### KPI columns on the owning tables

Add nullable `kpi_metric` (`kpi_metric` enum), `kpi_target` (`DECIMAL(18,4)`) and `kpi_updated_at` to `organization`, `project` and `campaign`. A check constraint keeps metric and target both set or both null.

One KPI per level makes a separate table unnecessary. Cascade deletion comes for free, and the Meta import never writes these columns because it only updates name, status and objective.

A polymorphic `kpi_target` table was rejected: it needs partial unique indexes per level and extra reach joins for no gain while the rule is one KPI per level.

### A `kpi` module with three scoped endpoints

`GET`, `PUT` and `DELETE` on:
- `/api/organization/kpi`
- `/api/projects/:id/kpi`
- `/api/campaigns/:id/kpi`

`PUT` accepts `{ metric, target }` with `target` as a decimal string. Reads return `{ metric, target, updatedAt } | null`.

Access checks:
- **Projects and campaigns** use the existing reach adapters, then `can(actor, "update", "project" | "campaign")` for writes.
- **The organization** requires `can(actor, "update", "organization")`, which today means ADMIN. That matches "reaches the whole organization".

Set and clear run in a unit of work together with an `UPDATE` audit event on the owning entity. The event summary names the change, and `changes.before`/`changes.after` hold the metric and target.

Embedding the KPI in the existing project, campaign and summary reads was rejected. It would widen three read models and their OpenAPI contracts, and KPI writes would need separate endpoints anyway.

### KPI progress is computed in the web entity

`entities/kpi/model/progress.ts` exports:
- `KPI_METRICS`: the twelve metrics with their `Performance` keys and labels.
- `isMonthly(metric)`: true for spend, impressions, reach, clicks, conversions and revenue.
- `isLowerBetter(metric)`: true for cpc, cpm, cpa and frequency.
- `targetForRange(kpi, range)`: prorates a monthly target over each day's calendar month.
- `kpiProgress(performance, kpi, range)`: returns `{ actual, target, percent, state: "exceeded" | "met" | "behind" | "unmeasured" }`. It reports exceeded when the actual figure is strictly better than the target and met when equal. The tile writes Выполнено or Выполнено+ only for those two states, and animates the progress bar with a CSS keyframe shine while exceeded, disabled under `prefers-reduced-motion`.

The backend only stores targets, so the calculation stays next to the figures and period the page already holds.

Server-side computation was rejected: it would need the range and the aggregated figures, duplicating the summary endpoints.

The metric identifiers in the API are `SPEND`, `IMPRESSIONS`, `REACH`, `CLICKS`, `CONVERSIONS`, `REVENUE`, `CTR`, `CPC`, `CPM`, `CPA`, `ROAS` and `FREQUENCY`. They map to `Performance` keys, so the rename to Лиды/CPL stays a label change.

### Tile layout store and summary composition

`widgets/agency-overview/summaryTiles.ts` is a zustand `persist` store named `adpulse-summary-tiles` holding `layouts[userId][screen]`, where `screen` is `dashboard | project | campaign`. It exposes:
- `useSummaryTiles(screen)`, which returns the selected ids in catalogue order and falls back to `["conversions"]` when nothing is stored;
- `toggleTile`, which enforces the limit of five.

`PerformanceSummary` takes `screen`, `range` and an optional `kpi` binding `{ scope, canEdit }`. It filters stored ids against the catalogue available on that screen and renders:
- the chosen `MetricCard`s;
- `KpiTile` when chosen;
- the placeholder button.

`SummaryTilesDialog` renders thumbnails with the same card components at reduced scale. Each thumbnail is a `button` with `aria-pressed`, `data-selected` drives the highlighted border, and the counter reads `{selected}/5`.

`features/kpi-target` holds `KpiTile` data wiring and `KpiTargetDialog`: a metric select, a target field with a monthly or as-is hint, save, clear and cancel. It uses `entities/kpi` queries keyed by scope.

Pages pass their screen, range and KPI scope. The dashboard passes an organization scope only when the member may update the organization.

## Risks / Trade-offs

- [Reach is not additive across days, so prorating a monthly reach target is approximate] → Accepted; the target hint states that it is monthly and prorated.
- [Money targets on the dashboard mix project currencies, as the agency summary already does] → No conversion; same behaviour as existing agency figures.
- [A stored layout names KPI for a member who later loses organization update rights] → Unavailable tiles are filtered at render time.
- [Proration makes a month in progress look behind] → Expected for a period target; members pick shorter periods to judge pace.

## Migration Plan

1. Create the `kpi_metric` enum and add the three nullable columns to `organization`, `project` and `campaign`, with a both-or-neither check constraint. All existing rows get null KPIs, and no other column or row changes.
2. Apply the migration to a copy of the populated development database and verify that organizations, projects, campaigns and metrics survive unchanged.
3. Deploy the migration before the application. Rollback removes the endpoints and UI; the nullable columns stay inert.
