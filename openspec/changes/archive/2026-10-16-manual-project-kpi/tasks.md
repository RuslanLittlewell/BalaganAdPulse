## 1. A project KPI can be set by hand in the API

- [x] 1.1 Add `MANUAL` to the `KpiMetric` enum and `kpiName`, `kpiValue` to `Project`, with the migration
- [x] 1.2 Accept `{ metric: "MANUAL", name, value, target }` in the KPI schemas, refuse it for the organization and campaigns in the use case, read and write name and value in the repository, audit them, document the shapes in OpenAPI
- [x] 1.3 Carry name and value of a manual project KPI in the projects summary and its OpenAPI schema
- [x] 1.4 Cover it: set, read and replace a manual project KPI both ways, the audit, invalid name, value and target, refusal on a campaign and the organization, the projects summary entry; `npm test` green

## 2. The dialog, the tile and the colours

- [x] 2.1 Add the manual KPI to the web KPI types, `kpiInputOf` and `kpiProgress`, `formatNumber` and the `"number"` format, and its copy
- [x] 2.2 Offer Вручную in a project's KPI dialog with Название, Значение and Цель, prefilled when editing; show a manual KPI on the tile under its name
- [x] 2.3 Make `projectTone` follow a manual KPI and keep `campaignTone` from falling back to one
- [x] 2.4 Cover it: progress of a manual KPI, the dialog's fields, validation and the request it sends, its absence for campaigns and the organization, the tile, the project marker, a campaign beside a manual project KPI; `npm run test:web` green
- [x] 2.5 Note the manual KPI in README.md; `openspec validate manual-project-kpi --strict`
