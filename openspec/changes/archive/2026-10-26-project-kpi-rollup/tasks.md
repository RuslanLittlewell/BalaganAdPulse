## 1. API

- [x] 1.1 Add a migration moving KPIs naming no account to a project's only account.
- [x] 1.2 Count the limit per account and for the KPIs naming none, five each.
- [x] 1.3 Cover the migration's rule and the limit.

## 2. Web

- [x] 2.1 Replace `leastMetProgress` with `kpiResult`; use it in the project list, the dashboard's table, trend and gauge.
- [x] 2.2 Make the campaign indicator follow only the campaign's own KPI.
- [x] 2.3 Put the tabs back above the table and switch the one summary to the chosen account's figures and KPIs.
- [x] 2.4 Make the KPI tiles and the dialog edit the summary's part of the KPIs, keeping the rest, mark KPIs naming no account «Весь проект», and drop the «Кабинет» picker.
- [x] 2.5 Cover the web: the result's rule, the campaign indicator, the page's layout and switching summary, the dialog's part and new KPIs' account.
- [x] 2.6 Run the API and web suites until green; `openspec validate project-kpi-rollup --strict`.
