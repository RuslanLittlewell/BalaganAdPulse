## Context

`campaign.kpi_metric` / `kpi_target` exist and are served through `/campaigns/:id/kpi` and on every
campaign as `kpi`. `campaignTone` on the web already prefers the campaign's own KPI over the
project's least-met KPI. The only thing missing is a way to set it and a way to read it on the
project page.

## Decisions

- **Result type on the campaign row.** A nullable `kpi_result_type` text column next to the other
  KPI columns, as `project_kpi.result_type` is. The shared KPI schema accepts `resultType`; the use
  case refuses it on the organization, on metrics other than results and cost per result, and for
  the unknown type, through the same `assertResultType` the project KPIs use.
- **The campaign tile replaces the project's tiles on the campaign page.** A project's monthly
  targets compared with one campaign's figures say little about the campaign; the campaign's own
  goal does. The tile goes where the project's choice places KPI, or after the chosen tiles, so
  the goal can always be set from the campaign.
- **Fresh colours after a save.** The dialog invalidates the campaign and project campaign queries
  so the indicator and the blocks follow the new KPI without a reload.
- **Highlight through the table.** `PerformanceTable` takes `highlightedId`; the row carries
  `data-highlighted` and, when the table is windowed, the table scrolls the row into its window.
- **Blocks follow the table.** The blocks are built from the campaigns the table lists (the chosen
  account and the running-only switch), in the same order, so a highlighted row is always in the
  table.
