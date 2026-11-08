## Why

The dashboard's project table asks for each project's figures one project at a time:
a summary and a daily series per project, so thirty projects cost sixty requests every
time the dashboard opens or the period changes. On the server each of those, and the
agency and channel summaries beside them, reads the measured days one campaign at a
time. The page slows down in step with the agency's size.

## What Changes

- A new reading, `GET /api/summary/projects?from&to`, returns every project the member
  reaches in one response: each project's totals over the range and its daily series.
- The dashboard's project table draws from that one reading instead of two requests per
  project.
- The server reads the measured days of many campaigns in a single query; the agency,
  channel and per-project summaries use it too, so none of them costs a query per
  campaign.
- The per-project `summary` and `daily` readings stay: the project page still uses them.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `campaign-metrics`: adds the requirement that every reachable project's figures and
  daily series can be read in one request, following the same reach rules as the
  agency summary.

## Impact

- API: `apps/api/src/modules/campaigns` (metric port and Prisma adapter, project reach
  port, use cases, router, OpenAPI document).
- Web: `entities/campaign` (API client, query hook) and
  `widgets/agency-overview/ProjectPerformanceTable.tsx`.
- No schema change and no migration.
