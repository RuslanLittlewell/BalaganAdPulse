# AdPulse Frontend — Design (Phase 4: campaign sheets)

**Date:** 2026-08-03
**Status:** approved

> Shared context and conventions: [conventions.md](../conventions.md).

## Context

Phase 2 delivered campaigns, properties, records and computed metrics on the backend
(see [2026-07-21-adpulse-campaigns-design.md](2026-07-21-adpulse-campaigns-design.md)).
Phase 3 delivered the shell: the client sidebar, the client dialog and a main area
that shows a client header and nothing else (see
[2026-07-24-adpulse-frontend-shell-design.md](2026-07-24-adpulse-frontend-shell-design.md)).

Phase 4 fills that main area. A client owns several campaigns; each campaign is one
grid of daily statistics. The UI calls a campaign a **sheet** — a tab above a table —
while the domain keeps the name `Campaign`, the distinction Phase 2 established.

The whole read path already exists on the server. `GET /api/campaigns/:id` returns the
campaign with its properties in display order, its records as day rows, every value
already computed, and a totals row. Formulas are evaluated server-side, so the
frontend renders numbers and never interprets an expression tree.

## Scope

**In scope:** listing a client's campaigns as a tab strip, selecting one via the URL,
fetching that campaign's table and rendering it — property columns, day rows, a totals
row — with values formatted per property type. Empty, pending and error states for
both the tab strip and the table.

**Out of scope:** creating, renaming, reordering and deleting campaigns; editing
cells; adding and removing day rows; property (column) management; a formula editor;
the period filter; KPI tiles; CSV import. Every one of these has a backing endpoint
already; they are later slices layered on this read path. Controls for them are not
rendered at all — not rendered disabled.

## Architecture

A new feature folder `features/campaigns/`, mirroring `features/clients/`:

```
features/campaigns/
  data/api.ts          endpoint wrappers and payload types
  data/queries.ts      TanStack Query hooks
  components/CampaignTabs/    campaign list -> Tabs -> navigation
  components/CampaignSheet/   table payload -> DataTable
```

Two components join the shared library. Both are presentational, take props only, and
name no domain concept — the rule from Phase 3 that keeps `components/` reusable:

| Component | Props | Responsibility |
|-----------|-------|----------------|
| `components/Tabs/` | `items: {id, label}[]`, `activeId`, `onSelect` | A `role="tablist"` strip of buttons. No routing. |
| `components/DataTable/` | `columns: {id, label, align}[]`, `rows: {id, cells}[]`, `footer?` | Scroll container, sticky header row, sticky first column. No data shaping. |

`CampaignTabs` and `CampaignSheet` supply the campaign vocabulary. Splitting it this
way means the grid is available to any later feature — a report view, a comparison
table — without dragging campaign types along.

`EmptyState` gains an optional `action` slot, so the error state can carry a retry
button without a second component.

The campaign list is fetched by `ClientPage`, not by `CampaignTabs`: the redirect to
the first campaign and the "no campaigns" empty state both need it, and one cache
entry should have one owner. `CampaignTabs` receives the list as a prop and owns only
the mapping and the navigation. `CampaignSheet` owns its own table query, because
nothing above it needs the table.

## Routing

`App` gains a second path rendering the same page component:

```
/clients/:clientId                          -> ClientPage
/clients/:clientId/campaigns/:campaignId    -> ClientPage
```

`ClientPage` renders the client header, then `CampaignTabs`, then `CampaignSheet`.
When the URL carries no `campaignId` and the client has at least one campaign,
`ClientPage` redirects to the first campaign with `replace`, so the tab strip always
has a selection and the back button does not accumulate redirect steps. A client with
no campaigns stays on the bare `/clients/:clientId` URL.

## Data

```ts
campaignsApi.list(clientId)   // GET /api/clients/:clientId/campaigns
campaignsApi.get(campaignId)  // GET /api/campaigns/:id
```

`list` returns campaign summaries — enough for the tabs. `get` returns the table:

```ts
interface CampaignTable {
  id: string;
  clientId: string;
  name: string;
  position: number;
  properties: CampaignProperty[];              // ordered columns
  records: { id: string; date: string; values: Record<string, string | null> }[];
  totals: Record<string, string | null>;
}
```

`values` and `totals` are keyed by property id. Numbers cross the API as strings with
four decimals, per the shared conventions; the frontend keeps them as strings and
formats for display only.

Query keys follow the existing `queries.ts` shape: `["clients", clientId, "campaigns"]`
for the list and `["campaigns", campaignId]` for the table. Only the selected sheet is
fetched — each table is a full payload — and switching tabs leaves the previous one in
the cache.

## Rendering

Columns are a leading `DATE` column followed by `properties` in the order given. Rows
come from `records`; `totals` becomes the footer row, labelled `TOTAL`.

A `lib/format.ts` module maps a value to display text by property type:

| Type | Value in | Rendered | Alignment |
|------|----------|----------|-----------|
| `MONEY` | `120.0000` | `120.00` | right |
| `NUMBER` | `4500.0000` | `4,500` | right |
| `PERCENT` | `2.0000` | `2.00%` | right |
| `TEXT` | `good day` | `good day` | left |
| any | `null` | `—` | — |

`MONEY` keeps two decimals; `NUMBER` trims trailing zeros; both group thousands with
`en-US` separators. Cells carry no currency symbol — the column header already names
the metric, and a symbol per cell widens every money column for no information.
Numeric cells use `--font-mono` so digits align down a column. Dates render
`2026-08-01` as `01 Aug`.

One property of the totals row is worth stating because it is not obvious from the
label: percent columns hold the **average** across days, not a sum, and money and
number columns hold the sum. Computed columns are derived from those aggregates rather
than summed cell by cell. This is what the server already computes; the UI displays it
unchanged.

## States

| Situation | Rendering |
|-----------|-----------|
| Client has no campaigns | `EmptyState` in place of both tabs and table |
| Campaign has no records | Tabs render; `EmptyState` replaces the table |
| Either query pending | Nothing, matching `ClientPage`'s existing convention |
| Either query failed | `EmptyState` with `state.error.title` copy and a retry button |

All new copy — the two empty-state titles and descriptions, the `DATE` and `TOTAL`
column labels — goes in the `i18n/en.ts` dictionary rather than in components, as in
Phase 3. The error and retry keys already exist.

## Testing

TDD throughout, with MSW standing in for the API — no backend and no database, per the
frontend testing convention.

| Unit | Covered by its test |
|------|---------------------|
| `Tabs` | Renders an item per entry, marks the active one, calls `onSelect` |
| `DataTable` | Renders columns, rows and the footer row; applies alignment |
| `format` | Every property type, null values, grouping, trailing-zero trimming |
| `CampaignTabs` | A tab per campaign, active tab from the URL, navigates on click |
| `CampaignSheet` | Columns from properties, a row per record, formatted values, totals footer |
| `ClientPage` | Redirects to the first campaign; empty state when the client has none |
