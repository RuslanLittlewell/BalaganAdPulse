## Context

`ProjectPerformanceTable` lists projects from `GET /api/projects` and then runs two
`useQueries` fan-outs: `/projects/:id/summary` and `/projects/:id/daily` for every
project. The use cases behind those, and behind `/summary` and `/summary/channels`,
list the reachable campaigns and then call `MetricRepository.readCampaignRange` once per
campaign; the agency and channel summaries even await those calls one after another.

## Goals / Non-Goals

**Goals:**
- One HTTP request for the whole project table, whatever the number of projects.
- A fixed number of database queries per summary reading, independent of how many
  campaigns are summed.

**Non-Goals:**
- Folding the agency summary, the channel shares or the CRM stage counts into the same
  response. Each is already one request; merging them would couple widgets that refresh
  and fail separately.
- Changing the project page, which reads one project and keeps its own readings.

## Decisions

**A route under `/summary`, not under `/projects`.** `GET /api/summary/projects` sits
beside the agency and channel summaries it resembles: an organization-wide reading over
a range. The web key `["summary", "projects", range]` falls under the `["summary"]`
prefix that the Meta import already invalidates when it finishes, so the table refreshes
with the rest of the dashboard without new invalidation code.

**Entries carry the project id, not the project.** The table already holds the project
list (names, currency, order, avatars) from the shared projects query that the sidebar
uses too; the reading adds only figures, joined by id on the client. Repeating project
fields would duplicate a cache that has its own invalidation.

**Every reachable project is listed, measured or not.** `ProjectReach` gains
`listReachable(actor)` so the response names projects with no campaigns too, with zeros.
The alternative, listing only projects that have campaigns, would leave a consumer unable
to tell "nothing measured" from "not yours".

**One query for many campaigns.** `MetricRepository` gains
`readCampaignsRange(campaignIds, from, to)`, a single `findMany` with `campaignId IN (…)`
returning each day tagged with its campaign. The use cases group the rows in memory: by
project for the new reading, by currency for the agency summary, by channel and currency
for the channel shares, and as a whole for the per-project summary and daily series.
Grouping in SQL (`GROUP BY project, date`) was considered; it would need raw SQL across
the campaign join for a saving that does not matter at this size, while the in-memory
grouping reuses `performanceOf` and `sumByDay` as they are.

## Risks / Trade-offs

- [A large `IN (…)` list for an agency with very many campaigns] → the list is bounded
  by the campaigns the member reaches, and the rows read are the same ones the per-campaign
  reads fetched before, in one round trip instead of hundreds.
- [The response grows with projects × days] → a daily series is at most the range's
  length per project; for 30 projects over a quarter it is a few thousand small objects,
  less than the sixty responses it replaces.
