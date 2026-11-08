## Context

`GET /api/crm/project-stage-counts` counts a period's leads per project and fixed stage with one
`lead.groupBy` over `projectId` and `stage`. A lead arrives at its Meta `submittedAt` when it has
a Meta source and at `createdAt` otherwise. The dashboard's `ProjectPerformanceTable` reads it
through `useProjectStageCounts` and feeds the counts to `PerformanceTable` as extra columns with
the ids `crm-NEW`, `crm-QUALIFIED`, `crm-TARGET` and `crm-PROPOSAL`, labelled from
`dashboard.crmColumn` and `crm.stage.*`.

A Meta import stores `lead.campaign_id` and `lead.ad_id` from the campaign and ad it finds by
external id, and `linkAttribution` fills them in later for leads imported before their campaign
was synced. A hand-made lead has neither. An ad belongs to one ad set through `ad.ad_set_id`;
the lead does not store its ad set.

The CRM router sits behind `requireModule("CRM")`, which answers 404 when the module is off.
Every role may read leads, and `authorize(actor, board, "read")` in the lead use cases answers
404 for a board the member cannot reach.

The project page builds its campaign table with `tableKey` `campaigns:<account>`, a totals row
and result type extra columns. The campaign page builds its ad set table with ad rows as
children of expanded ad sets and no totals row. Extra columns without `shown` stay hidden until
a member turns them on, and a saved choice that does not name a column keeps it hidden.

## Goals / Non-Goals

**Goals:**
- One request gives both campaign pages everything they need for one project and period.
- A column id means the same stage in every table, so the dashboard rename keeps saved choices.

**Non-Goals:**
- Counting a lead by the stages it passed through. Counts stay by current stage, as on the
  dashboard.
- Cost per lead in a stage.
- Letting a member attribute a hand-made lead to a campaign.

## Decisions

### One board endpoint grouped three ways

`GET /api/crm/boards/:boardKey/stage-counts?from=&to=` returns
`{ campaigns: [{ campaignId, NEW, QUALIFIED, TARGET, PROPOSAL }], adSets: [{ adSetId, ... }], ads: [{ adId, ... }] }`
for the board's project. The project page reads `campaigns`; the campaign page reads `adSets`
and `ads`. Both pages ask with the same project and period, so React Query serves the campaign
page from the cache when a member opens a campaign from the project page.

Placing it under `/boards/:boardKey` reuses `authorize(actor, board, "read")` for the 404 on an
unreachable board and keeps the CRM module gate.

Two alternatives were rejected. Adding lead counts to the campaign, ad set and ad responses
would make the campaigns module read CRM data, bypass the CRM module gate and need a gate of its
own. Separate endpoints per project and per campaign would cost a second request and a second
authorization path for the same data.

### Counting in the database, ad sets resolved through ads

The repository runs one `lead.groupBy` over `campaignId`, `adId` and `stage`, with the same
`orgId`, `stage: { not: null }` and arrival window filter as the project counts, narrowed to
`projectId: board`. It then reads `ad.findMany({ where: { id: { in: adIds } }, select: { id, adSetId } })`
for the ads that appear. A pure domain function folds the groups into the three lists: campaign
rows by `campaignId`, ad rows by `adId`, ad set rows by the ad's `adSetId`. Groups with a null
key are skipped for that list, so a lead without an ad still counts for its campaign. Each list
is sorted by id for a stable response.

Joining `lead` to `ad` in raw SQL would save the second query, but the folded groups are few,
and keeping Prisma's typed `groupBy` matches the project counts.

The arrival window filter is extracted so the project counts and the board counts share it.

### Column ids and labels shared by every table

A helper in `widgets/performance-table`, beside `resultTypeColumns`, builds the extra columns
for a list of stages and the figures for one row. Columns keep the ids `crm-<STAGE>`. Labels
come from new `ru.ts` keys `crm.column.NEW` (Лид (Новый)), `crm.column.QUALIFIED` (Квал. лид),
`crm.column.TARGET` (Целевой лид) and `crm.column.PROPOSAL` (КП); `dashboard.crmColumn` is
removed. The dashboard passes all four stages, the campaign tables pass the last three. Because
the ids do not change, a member's saved dashboard choice applies to the renamed columns.

The campaign tables add the stage columns after the result type columns, and only while
`useModuleEnabled("CRM")` holds; the query is disabled otherwise. A row whose id is missing
from the response shows 0. The project page's totals row sums the listed rows' counts, so it
follows the running-only switch like the other totals.

## Risks / Trade-offs

- [A lead imported before its campaign was synced counts in no campaign until `linkAttribution`
  runs] → The same delay applies to the lead card's ad preview today; the next sync fills it in.
- [Ad set counts can be lower than their campaign's when some leads have no ad] → This follows
  from the spec: such a lead belongs to the campaign and to no ad set.
- [A campaign with many ads makes the `ads` list long] → Only ads with counted leads are listed,
  and the response holds ids and integers only.

## Migration Plan

No schema or data change. Deploying the API and web together is enough; the old dashboard
column choices keep working because the column ids stay the same. Rolling back restores the old
labels.
