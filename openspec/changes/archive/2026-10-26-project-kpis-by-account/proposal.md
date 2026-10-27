## Why

A project whose campaigns come from several advertising accounts holds one list of KPIs, and
every KPI is measured on the whole project. A manager who sets 60 leads for one account and 30
for another gets two KPIs that both count the leads of both accounts, so neither says how its
account is doing. The account tabs on the project page narrow only the campaign table, while the
metrics above it keep showing the whole project.

## What Changes

- A project KPI may name one of the project's advertising accounts. Such a KPI is measured only
  on the figures of the campaigns imported from that account, everywhere a KPI is measured: its
  tile, the project's result in the project list, the dashboard's table and gauge, the KPI-met
  notification and the indicators of the campaigns. A KPI naming no account stays common to the
  whole project and is measured on the project's figures, as today.
- The account tabs move from above the campaign table to above the project's metrics. Choosing
  an account's tab shows that account's figures in the summary tiles, its KPIs and the common ones
  in the KPI tiles, and its campaigns in the table. A common KPI's tile is marked «Все кабинеты».
- In a project with several accounts, each block of the KPI dialog offers a «Кабинет» choice of
  the project's accounts and «Все кабинеты». The dialog opened on an account's tab shows that
  account's KPIs and the common ones, a new block names that account, and saving keeps the KPIs of
  the other accounts.
- The limit of five KPIs applies to what one account's tab shows: its own KPIs and the common ones.
- A campaign without a KPI of its own follows the least-met of the common KPIs and its account's.
- The projects summary carries, for each account a project's KPIs name, that account's figures.

## Capabilities

### New Capabilities

### Modified Capabilities
- `kpi-targets`: project KPIs may belong to an advertising account and are measured on its figures.
- `meta-project-integration`: the account tabs switch the project's metrics and KPIs as well as its campaigns.
- `campaign-metrics`: the projects summary carries the figures of the accounts a project's KPIs name.

## Impact

- API: `project_kpi` gains the account's channel and id (migration); the project KPI schemas,
  the replace use case and its limit, the projects summary, the KPI standings of the KPI-met
  notification, and the OpenAPI documents.
- Web: the KPI entity and its progress model, the KPI tile, card and project dialog, the project
  page's layout and figures, the campaign indicator, the project list's tone, the dashboard's
  project table, trend and standings, and `ru.ts`.
- Existing KPIs name no account and keep being measured on the whole project.
