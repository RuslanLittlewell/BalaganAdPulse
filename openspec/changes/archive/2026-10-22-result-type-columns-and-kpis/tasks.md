## 1. API

- [x] 1.1 Read typed days for campaigns; report types and typed figures on campaigns, ad sets, ads, the project summary and the dashboard projects and days, with OpenAPI schemas.
- [x] 1.2 Add `result_type` to `project_kpi`; accept, validate, store and return it; compute typed KPI progress, including the KPI-met notification.

## 2. Web

- [x] 2.1 Carry typed figures and campaign types; merge them in totals.
- [x] 2.2 Add the per-type column pairs to the campaign and ad set tables; show new default columns to members who chose columns before.
- [x] 2.3 Offer typed KPIs in the KPI dialog; label and compute them everywhere a KPI is shown.

## 3. Verification

- [x] 3.1 Cover typed days, typed KPI progress and validation, the columns, the dialog and the column visibility.
- [x] 3.2 Run `npm test` until green; `openspec validate result-type-columns-and-kpis --strict`.
