## 1. Import and serve results

- [x] 1.1 Add `results` to the three daily metric models, `RESULTS`/`COST_PER_RESULT` to `KpiMetric` and `RESULTS` to `SummaryTile`, with one migration.
- [x] 1.2 Read `results` in `GraphProvider` with a separate Insights request per level, joined by entity and day (sum of default-attribution values, missing zero, rounded), into `ImportedMetric`.
- [x] 1.3 Sum `results` and derive `costPerResult` in the campaigns module; document both in OpenAPI; read `results` in the metric repository.
- [x] 1.4 Add the KPI metrics and the summary tile to their API catalogues.
- [x] 1.5 Cover the import (a replies campaign's results beside its leads, the separate request at each level, the join by day, a row without results, a fractional value, an invalid value), the derivation (cost per result, absent without results), the API's performance responses, the KPI and tile identifiers.
- [x] 1.6 Run `npm test` until green.

## 2. Show results on the web

- [x] 2.1 Add `results` and `costPerResult` to the performance type, the empty performance and `totalPerformance`; add both table columns.
- [x] 2.2 Add the KPI definitions: results monthly, cost per result as it is and lower-is-better.
- [x] 2.3 Add `RESULTS` to the tile catalogue and render the Результаты tile with Цена результата, summing results across currencies on the dashboard.
- [x] 2.4 Cover the table columns, the totals, the KPI progress for both metrics and the tile.
- [x] 2.5 Run `npm run test:web` until green; `openspec validate import-meta-results --strict`.
