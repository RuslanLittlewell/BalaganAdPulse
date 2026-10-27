## 1. Metric list

- [x] 1.1 Add `measuredTitle` to `kpiTitle.ts`, naming the results of a type «Результаты - <тип>», and use it for `kpiTitle`.
- [x] 1.2 Build the options of `MeasuredChoices` with `measuredTitle` and sort them by label with the Russian collation.
- [x] 1.3 Cover the project dialog: «Лиды» and «Результаты - Лиды» are both offered, the order, «Вручную» last; update the typed-KPI tests to the new label.
- [x] 1.4 Run the web suite and typecheck until green; `openspec validate kpi-metric-list-order --strict`.
