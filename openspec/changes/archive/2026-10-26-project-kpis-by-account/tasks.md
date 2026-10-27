## 1. API

- [x] 1.1 Add `channel` and `source_account_id` to `project_kpi` with a migration; carry `account` through the KPI domain, repository, schemas, OpenAPI and audit snapshot.
- [x] 1.2 Replace the project KPI limit with five per account, its own and the common ones, and five common ones.
- [x] 1.3 Carry each KPI's account in the projects summary, and the figures and days of every account the project's KPIs name.
- [x] 1.4 Measure each KPI of the KPI-met notification on its account's figures.
- [x] 1.5 Cover the API: storing and reading an account, the per-account limit, the summary's account figures, the notification measured per account.

## 2. Web

- [x] 2.1 Add the account to the KPI entity, and make `leastMetProgress` and the trend measure each KPI on its own figures; pick a KPI's figures from a projects summary entry.
- [x] 2.2 Use them in the project list, the dashboard's project table, trend and standings, and the campaign indicator.
- [x] 2.3 Move the account tabs above the metrics and show the chosen account's figures and KPIs, marking common KPIs «Все кабинеты».
- [x] 2.4 Add the «Кабинет» choice to the project KPI dialog, open it on the chosen account's share and keep the other accounts' KPIs on saving.
- [x] 2.5 Cover the web: KPI figures per account, the page's tabs switching tiles and KPIs, the dialog's account choice and saving, the campaign indicator ignoring another account's KPI.
- [x] 2.6 Run the API and web suites until green; `openspec validate project-kpis-by-account --strict`.
