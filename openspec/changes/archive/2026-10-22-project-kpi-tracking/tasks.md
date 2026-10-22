## 1. API

- [x] 1.1 Add `kpi_tracked` to the project table and schema; carry it in the project record, its DTO and its update, which needs the right to change KPIs as well.
- [x] 1.2 Return an empty KPI list for an untracked project in the projects summary, and send no KPI-met notification for it.

## 2. Web

- [x] 2.1 Show the Отслеживать KPI switch in the project header, active only for members who may change KPIs.
- [x] 2.2 Leave untracked projects out of the dashboard's gauge and notices.

## 3. Verification

- [x] 3.1 Cover the API, the header and the dashboard; update fixtures.
- [x] 3.2 Run `npm test` and `npm run test:web` until green; `openspec validate project-kpi-tracking --strict`.
