## Context

`project-kpis-by-account` let a project KPI name an advertising account and measured it on that
account's figures everywhere, but kept the project's result as its least-met KPI, edited every KPI
in one project dialog with a «Кабинет» picker, and moved the account tabs above the metrics. The
projects summary already carries each KPI's account and the figures and days of every account the
KPIs name, so the browser can measure each KPI on its own figures.

## Goals / Non-Goals

**Goals:**
- One rule for a project's result, used by the project list, the dashboard's table, trend and
  gauge: the average of equal account shares, each the average of its KPIs capped at 100%.
- The page's one summary switching with the account tabs, which stay above the campaign table.
- Campaign indicators on the campaign's own KPI only.

**Non-Goals:**
- Changing the KPI-met notification, which already asks every enabled KPI to be met; with capped
  averages that is the same moment the result reaches 100%.
- Weights other than equal shares.
- A summary-tile choice per account; an account's summary uses the project's choice.

## Decisions

- **`kpiResult` replaces `leastMetProgress`.** It groups enabled, measured KPIs by the account they
  name, `null` being the project's own group, averages each group's percentages capped at 100, and
  averages the groups; it returns `null` when nothing is measured. The trend runs the same function
  day by day over the measured KPIs. `leastMetProgress` loses its last callers and is removed.
- **The summary is told which KPIs it holds** by a part of the project's list: the chosen account's
  KPIs with those naming none, or all of them. The dialog edits the same part and keeps the rest when
  saving, and a new block takes the part's account; the «Кабинет» picker goes. A KPI naming no
  account keeps the project's figures and a «Весь проект» note, so nothing that counts toward the
  result is hidden.
- **The tabs go back above the table** with the running-only switch beside them, and the summary
  above them takes the chosen account's figures, summed in the browser from its campaigns as the
  totals row is. No second summary and no separate progress tile are added; the project's result
  shows in the project list and on the dashboard.
- **A one-off migration moves KPIs naming no account to a project's only account**, the accounts
  being the distinct pairs of its imported campaigns and connections, so a typical project's KPIs
  are its account's from the start and stay so when a second account arrives.
- **The limit counts each account's KPIs and the KPIs naming none separately**, five each, matching
  what one summary shows.

## Risks / Trade-offs

- [A capped average hides how far one KPI overshoots] → the KPI's own tile still shows its
  percentage and Выполнено+.
- [A project whose only account changes after the migration keeps KPIs naming the old account] →
  its tab stays shown through the KPI, so they can be edited or removed there.
