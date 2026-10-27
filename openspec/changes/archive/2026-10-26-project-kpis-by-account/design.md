## Context

A project's KPIs live in `project_kpi`, read and replaced as one ordered list. Campaigns carry
their account as `channel` and `sourceAccountId`; the project page builds its account tabs from
the project's connections and campaigns, keyed `channel:accountId`, and narrows only the campaign
table by the chosen tab. A KPI is measured on figures in four places: the KPI tile on the project
page (figures from the project summary), the project's result in the project list and the
dashboard (figures and daily figures from the projects summary), the campaign indicator (the
campaign's own figures), and the KPI-met notification (figures the notifications module sums in
`PrismaProjectKpiStandings`).

## Goals / Non-Goals

**Goals:**
- A project KPI that names an account is measured on that account's figures everywhere.
- The account tabs switch the project's metrics, KPIs and campaigns together.

**Non-Goals:**
- A tab combining the accounts.
- Campaign and organization KPIs, which stay as they are.
- Checking on the server that a named account is one of the project's; the dialog offers only
  those, and an account can leave a project after a KPI names it anyway.

## Decisions

- **The account is two nullable columns on `project_kpi`, `channel` and `source_account_id`,**
  the same pair a campaign carries, and `account: { channel, accountId } | null` in the API. Both
  are set or both are null. Existing rows stay null, which keeps their meaning: common to the
  project.
- **The limit counts what one tab shows.** A tab shows its account's KPIs and the common ones, so
  each account's own plus the common ones, and the common ones alone, are held to five. The schema
  caps the whole list at fifty only as a bound on the request.
- **Each KPI is measured on its own figures, chosen by one rule.** On the web, `leastMetProgress`
  and the trend take a function from a KPI to its figures instead of one set of figures. The
  projects summary carries `accounts: [{ channel, accountId, performance, days }]` for the accounts
  the project's KPIs name, computed from the campaign days it already loads, and a helper in the
  campaign entity picks a KPI's figures from an entry: its account's, or the project's when it names
  none, or zero when the account is missing. Alternative: per-account figures for every account of
  every project, which grows the dashboard's payload for nothing.
- **The KPI-met notification measures each KPI on its account.** The standings port returns each
  enabled KPI with the figures it is measured on, summed over the project's campaigns of its account,
  or all of them for a common KPI.
- **The project page measures an account's tab in the browser.** The summary tiles and the KPIs of
  the chosen account use `totalPerformance` of the account's campaigns, which the page already
  loads for the table and totals; common KPIs keep the project summary. With one account or none,
  the page shows the project summary as before.
- **The tabs move above the metrics.** They sit under the Метрики heading and the period control,
  above the summary tiles; the running-only switch stays above the table. KPI accounts join the
  tab sources, so a KPI naming an account the project no longer has stays visible and editable.
- **The dialog edits one tab's share of the list.** It opens with the KPIs naming the chosen
  account and the common ones; on saving it sends the drafts followed by the KPIs naming other
  accounts, in their order. A block's preview is measured on the figures of the account it names.

## Risks / Trade-offs

- [The browser's totals of an account could drift from the API's] → both sum the same campaign
  figures, and `totalPerformance` already makes the campaign table's totals row.
- [A KPI naming an account whose campaigns were moved away measures zero and drags the project's
  result down] → its tab stays shown, so the manager sees it and can make it common or remove it.
