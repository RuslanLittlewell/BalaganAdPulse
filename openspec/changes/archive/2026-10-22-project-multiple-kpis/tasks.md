## 1. API

- [x] 1.1 Add the `project_kpi` table and migrate the project KPI columns into it, then drop them; update the schema and the test database helper.
- [x] 1.2 Replace the project KPI route with a list read and replace under `/projects/:id/kpis`, with the five-KPI limit, the enabled flag, one audit event and the project event; keep the organization and campaign routes.
- [x] 1.3 Carry the project's KPIs, with their enabled flags, as `kpis` in the projects summary and OpenAPI.
- [x] 1.4 Send the KPI-met notification when every enabled KPI is met.

## 2. Web data

- [x] 2.1 Read and replace a project's KPI list; carry `kpis` with `enabled` in the projects summary types.
- [x] 2.2 Compute a project's result as its least-met enabled KPI and use it for the project list, the dashboard gauge, table column and trend, and the campaign indicator.

## 3. Web interface

- [x] 3.1 Show one KPI card per KPI on the project and campaign pages, and mark a switched-off KPI.
- [x] 3.2 Make the project KPI dialog a list of blocks with a metric, a target, a switch and removal, ending with an empty block.

## 4. Verification

- [x] 4.1 Cover the API, the result rule, the dialog and the cards; update the tests that carried one KPI.
- [x] 4.2 Run `npm test` and `npm run test:web` until green; `openspec validate project-multiple-kpis --strict`.
