## Context

`ProjectItem` paints the marker on the right edge of each project in the list with
`priorityColour(project.priority)`, and `ProjectRow`'s context menu offers a radio group of
five priorities to members allowed `update` on `project-priority`. The priority is a
`project_priority` enum column on `project`, returned on every project and accepted on
create and update, with its own row in the shared permission matrix.

The project's KPI is stored on the same row (`kpi_metric`, `kpi_target`). The KPI tile and
the campaign table already turn a KPI and a period's figures into a percentage on the
client, with `kpiProgress(figures, kpi, range)` in `entities/kpi`. Every reachable
project's figures for a period already come in one request, `GET /api/summary/projects`,
which the dashboard's project table uses.

## Goals / Non-Goals

**Goals:**
- The list's marker says how the project is doing against its KPI, computed exactly as
  the KPI tile computes it, so the two never disagree for the same period.
- One request colours the whole list, whatever the number of projects.
- No trace of the priority left: no column, no field, no permission, no copy.

**Non-Goals:**
- Changing the campaign indicator, whose zones the marker borrows but whose code stays
  its own.
- Falling back to campaign KPIs for a project without its own.
- A marker in the narrowed list, which shows pictures only and had no marker before.

## Decisions

**The period is the selected one.** The list reads the range through `usePeriod()`, the
same hook the project page and its KPI tile use, so the marker and the tile agree. On a
page without a period in the address that is the default thirty days, as everywhere else.
The alternative, the current calendar month, would match the monthly target more
literally but let the marker contradict the tile right beside it.

**The KPI travels in the projects summary.** `ProjectReach.listReachable` returns each
project's id with its KPI instead of the id alone, and every `ProjectFigures` entry gains
`kpi: { metric, target } | null`, formatted as the campaign's KPI already is. The list
then needs one reading for both halves of the comparison. Adding `kpi` to `GET /projects`
instead was rejected: the project record would carry a field that only makes sense next
to a period's figures, and the list would still need the summary for those.

**The tone is computed on the client.** `projectTone(kpi, performance, range)` in
`widgets/project-list` returns `none`, `danger`, `behind` or `met` from `kpiProgress`:
`none` without a KPI or a measured percentage, `danger` below 80, `behind` below 100,
`met` otherwise — the campaign indicator's zones, so a project and its campaigns read alike. It compares the percentage rounded to a whole number, as the tile prints
it: a monthly target prorated over a 31-day month sums to a hair above itself, so meeting it
exactly gives 99.99999…%, which the tile shows as 100% and the marker must paint green. It sits beside its only consumer; `campaignTone` stays where it is, since
it also weighs a campaign's delivery status and its project's KPI.

**Saving or clearing a project KPI refreshes the summary.** `useSaveKpi` and
`useClearKpi` invalidate the `["summary", "projects"]` prefix when the scope is a project,
so the marker follows a new KPI without a reload. The Meta import already invalidates
`["summary"]`, which covers new figures.

**Colours are tokens.** `--priority-*` gives way to `--kpi-marker-danger`,
`--kpi-marker-behind`, `--kpi-marker-met` and `--kpi-marker-none`, red, yellow, green and
grey in both themes, keeping the previous red and green shades and the amber the campaign
table paints its middle zone with. The marker's
`markerLabel` names the state in Russian for assistive technology.

**Priority sent by an old client is ignored, not refused.** The Zod schemas strip
unknown keys, so removing `priority` from them makes an old tab's request succeed without
storing it, rather than failing a rename that happens to carry it.

## Migration Plan

A migration drops `project.priority` and then the `project_priority` enum type. Every
stored priority is lost; nothing reads it after this change, and there is nothing to carry
over since the marker is derived. Projects, their KPIs and figures are untouched. Rolling
back means restoring the column with its default `NEW`, so every project would come back
as new.

## Risks / Trade-offs

- A list of many projects whose summary is still loading shows grey markers for a moment
  → acceptable: grey already means "nothing to judge yet", and the dashboard shares the
  same cached reading.
- A member whose role may not read campaigns cannot read the summary → every role may
  read campaigns today; were that to change, their markers would stay grey rather than
  fail.
