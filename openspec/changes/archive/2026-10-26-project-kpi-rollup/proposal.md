## Why

Splitting a project's KPIs by advertising account left the project's result as its least-met KPI
and kept every KPI in one project dialog with an account picker, while the account tabs moved above
the metrics. The agency reads it differently: a project's KPI is made of its accounts' KPIs, each
account carrying an equal share of the result and each of its KPIs an equal share of the account's;
an account's figures and KPIs belong under its own tab; and a campaign's KPI is a working note for
the media buyer that never counts toward the project.

## What Changes

- A project's result becomes the average over its accounts of the average of each account's
  enabled KPIs, every KPI counting at most 100%. With one account its KPIs make the whole result;
  KPIs naming no account count as one more share.
- The account tabs return above the campaign table. With more than one account, the chosen tab
  switches the page's one summary to that account's figures and KPIs; KPIs naming no account are
  shown there too, on the project's figures, marked «Весь проект». With one account or none, the
  summary shows the project and all its KPIs.
- KPIs are set where they are shown: the dialog edits the chosen account's KPIs and those naming no
  account, and a new KPI names the chosen account, or the project's only one; the «Кабинет» choice
  is removed.
- A campaign's indicator follows only its own KPI; without one it is grey.
- KPIs naming no account in a project with exactly one account are moved to that account.
- The limit of five KPIs applies to each account and to the KPIs naming none.

## Capabilities

### New Capabilities

### Modified Capabilities
- `kpi-targets`: the project's result rolls up its accounts' KPIs; campaign indicators follow only their own KPI; KPIs are edited per account.
- `meta-project-integration`: the account tabs sit above the campaign table and switch the page's summary to the chosen account.

## Impact

- API: a migration moving KPIs naming no account to a project's only account; the per-account limit.
- Web: the progress model of the KPI entity, the project list's tone, the dashboard's table, trend
  and gauge, the campaign indicator, the project page's layout, the KPI tile, card and dialog, `ru.ts`.
- The KPI-met notification keeps its rule: every enabled KPI met.
