## Context

`GET /api/summary/projects?from&to` already returns every project the member reaches with
its KPI (`{ metric, target, name?, value? }` or null) and its performance for the range.
`projectTone(kpi, performance, range)` in `widgets/project-list` turns that into the
project marker's zone (`none`, `danger`, `behind`, `met`) through `kpiInputOf` and
`kpiProgress` from `entities/kpi`, rounding to the percent the tile shows.
`shortcutRange("month")` in `features/period` gives the first of the month to today. The
dashboard page lays out `PerformanceSummary`, then `ProjectPerformanceTable` beside
`ChannelPanel`, all from `widgets/agency-overview`.

## Goals / Non-Goals

**Goals:**
- One rule for "meets its KPI" across the project list and the gauge.
- No new request shape and no API change.

**Non-Goals:**
- Counting campaigns, or a gauge for a single project or the organization KPI.
- Notices other than a missing project KPI. The Важная информация panel is named for the
  further notices it will carry, but this change puts only that one in it.

## Decisions

**The zones come from `projectTone`.** The gauge maps `met` to green, `behind` and `danger`
to red and `none` to grey, so a project is green on the gauge exactly when its marker is
green over the same range. `agency-overview` imports it from
`@/widgets/project-list/projectTone.js`, as `crm-calendar` already imports `week.js` from
`task-calendar`. Moving `projectTone` to `entities/kpi` was considered; it would move a
tested module and its tests for no behavioural gain, and can be done when a third widget
needs it.

**A missing KPI is told apart by `kpiInputOf`.** A project is listed in Важная информация when
`kpiInputOf(kpi)` is null — no KPI, or one this web build cannot read — which is a subset of
the grey part; a KPI whose figure is unmeasured is grey on the gauge but not warned about.

**One hook feeds both panels.** `KpiOverview` in `agency-overview` takes
`shortcutRange("month")` and calls `useMonthlyKpiStandings(range)` once, which reads
`useProjects()` and `useProjectsSummary(range)` and returns the met, behind and unrated
counts with the projects missing a KPI, in the order `useProjects` gives; it hands the counts
to `KpiGauge` and the projects to `ImportantInfo`. React Query shares the request with the
table when the dashboard's period is the current month. The pure part, `monthlyKpiStandings(projects,
figures, range)`, is tested on its own. Invalidating `PROJECTS_SUMMARY_KEY` on a KPI change
already refreshes every range, so both follow a change without a reload.

**The gauge is an inline SVG.** A semicircular path with `pathLength="100"` is drawn once
per part, each with `stroke-dasharray` of its share and `stroke-dashoffset` of the parts
before it; the needle is a line rotated by `share × 180° − 90°` about the hub. Colours are
the existing `--kpi-marker-met`, `--kpi-marker-danger` and `--kpi-marker-none` tokens, which
already have dark-theme values. No chart library is added for one shape. The SVG is
`role="img"` with an `aria-label` naming all three counts; the legend repeats them as text.
The needle's turn is a CSS transition behind `motion-safe:`.

**The panel links rather than embeds the KPI dialog.** Each warning is a link to the
project page with the current `location.search`, as rows of the project table navigate.
Setting the KPI there uses the existing tile and its permissions, so the panel needs no
knowledge of who may change a KPI.

**Layout.** A row between the summary tiles and the table holds the gauge, Важная информация and
the sources panel, which moves up from beside the table, `md:grid-cols-2 xl:grid-cols-3`;
the table then takes the full width below it. `KpiOverview` renders its two cards as grid
children of that row, so the page owns the grid. The list of projects without a KPI scrolls past a fixed
height so a long list does not push the table down.

## Risks / Trade-offs

- [The dashboard makes a second projects-summary request when its period is not the current
  month] → it is the same endpoint the table already calls and is cached per range.
- [Grey mixes "no KPI" with "not measured"] → the legend calls it Без оценки, and the
  Важная информация names only the projects that truly lack a KPI.
- [Many projects without a KPI make a long list] → the list scrolls within its card.
