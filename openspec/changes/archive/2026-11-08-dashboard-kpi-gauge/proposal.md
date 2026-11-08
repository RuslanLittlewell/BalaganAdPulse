## Why

The dashboard shows the agency's figures but not how its projects stand against their
KPIs. To learn that, a media buyer has to read the colour of every marker in the project
list, and a project nobody gave a KPI looks just like one whose figures are missing, so it
goes unnoticed and is never measured.

## What Changes

- The dashboard gains a gauge of the current month's KPI performance across projects. Its
  arc is split by project count into green (projects meeting their KPI), red (projects
  behind it) and grey (projects with no KPI or no figure to measure it by), with a needle at
  the green share. Under it the gauge reads "N из M" and a legend gives each count.
- The gauge always covers the current month from its first day to today, with monthly
  targets prorated as the KPI tile does; the dashboard's period selector does not move it.
- Beside the gauge, a panel titled Важная информация lists the projects with no KPI. Each
  opens the project, where its KPI can be set. With none missing, the panel says every
  project has a KPI. Further notices will join this panel later.

## Capabilities

### New Capabilities

- `kpi-overview`: the dashboard's monthly KPI gauge across projects and the Важная информация
  panel, which first lists the projects without a KPI.

### Modified Capabilities

None.

## Impact

- Web only: `widgets/agency-overview` (gauge, Важная информация panel, the monthly standings they
  share), `pages/dashboard/DashboardPage.tsx`, copy in `ru.ts`. Reads the existing
  `GET /api/summary/projects` for the current month; the API is unchanged.
