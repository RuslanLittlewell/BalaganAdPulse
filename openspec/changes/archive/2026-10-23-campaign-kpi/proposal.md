## Why

A campaign can already hold a KPI of its own, and its indicator in the project's campaign table
follows that KPI, but nothing in the interface sets it: the campaign page only shows the project's
KPIs. Managers want to give each campaign its own goal and see at a glance, above the campaign
table, which campaigns are on track.

## What Changes

- The campaign page shows the campaign's own KPI tile, with a control to set, change or clear it
  for members who may manage KPIs. It replaces the project's KPI tiles on that page and is shown
  even when the project's tile choice holds no KPI.
- A campaign KPI on results or cost per result can name a result type, as a project KPI can; the
  campaign dialog offers the types of the campaign. The organization KPI still cannot.
- The project page shows, above the campaign table, a small progress block for every listed
  campaign that holds its own KPI. Hovering or focusing a block highlights that campaign's row;
  pressing it opens the campaign.
- The blocks are also shown in preview.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `kpi-targets`: a campaign page that sets the campaign's KPI; progress blocks of campaign KPIs on
  the project page.
- `summary-tiles`: the campaign page's KPI tile is the campaign's own, with its controls.
- `result-types`: a campaign KPI can name a result type.
- `project-preview`: preview keeps the campaign KPI blocks.

## Impact

- API: `campaign.kpi_result_type` column and migration; the campaign KPI routes accept and return
  `resultType`; campaigns report it in `kpi`; OpenAPI schemas.
- Web: `KpiTargetDialog` offers typed choices for a campaign; `CampaignPage` uses the campaign
  scope; new `CampaignKpiStrip` on the project page; `PerformanceTable` highlights a row.
