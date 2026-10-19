## 1. Monthly standings

- [x] 1.1 Add `monthlyKpiStandings` and `useMonthlyKpiStandings` to `widgets/agency-overview`, counting met, behind and unrated projects through `projectTone` and collecting the projects without a KPI
- [x] 1.2 Cover it: met, behind (including the yellow zone), no KPI, unmeasured, a manual KPI, a prorated month-to-date target, project order; `npm run test:web` green

## 2. The gauge and Важная информация on the dashboard

- [x] 2.1 Add the copy to `ru.ts`; build `KpiGauge` (SVG arc parts, needle, "N из M", legend, accessible label, empty state) and `ImportantInfo` (projects without a KPI linking to the project with the period, count, all-set message)
- [x] 2.2 Place both in a row on `DashboardPage` between the summary tiles and the project table, with the sources panel moved up beside them and the table at full width below
- [x] 2.3 Cover it: the gauge's counts and label, — with no projects, the current month regardless of the selected period, the list of projects without a KPI, its link keeping the period, the all-set message; existing dashboard tests still pass; `npm test` and `npm run test:web` green
- [x] 2.4 Mention the gauge and Важная информация in README.md; `openspec validate dashboard-kpi-gauge --strict`
