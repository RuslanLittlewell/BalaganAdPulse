## 1. One query for many campaigns

- [x] 1.1 Add `readCampaignsRange(campaignIds, from, to)` to `MetricRepository` and its Prisma adapter: one query, each day tagged with its campaign, an empty id list reading nothing
- [x] 1.2 Route the agency summary, the channel shares and the per-project summary and daily series through it
- [x] 1.3 Cover the adapter (several campaigns in one call, no foreign campaign, the range's endpoints, no ids) and keep the application and API summary tests green

## 2. The projects summary reading

- [x] 2.1 Add `listReachable(actor)` to the campaigns module's `ProjectReach` and its Prisma adapter
- [x] 2.2 Add the `projectsSummary` use case: one entry per reachable project with its performance and daily series, zeros for a project with nothing measured
- [x] 2.3 Expose `GET /api/summary/projects` with the range query, and document it in the OpenAPI document
- [x] 2.4 Cover it: every reachable project in one response, a project with nothing measured, the range's limits, a partial grant, an unreachable project, a reversed range, a role that may not read campaigns

## 3. The dashboard reads it

- [x] 3.1 Add `projectsSummary` to the web campaigns API and a `useProjectsSummary(range)` hook keyed under `["summary", "projects"]`
- [x] 3.2 Draw `ProjectPerformanceTable` from that one reading instead of the per-project fan-out
- [x] 3.3 Cover it: the dashboard lists every project's figures and sparklines from the one request and asks for no per-project summary or daily series
- [x] 3.4 Note the reading in README.md
