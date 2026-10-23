## 1. API

- [x] 1.1 Add `kpi_result_type` to `campaign`; read and write it in the KPI repository and report it on campaigns.
- [x] 1.2 Accept `resultType` on the campaign KPI routes, refusing it on the organization, other metrics and unknown; update the OpenAPI schemas.

## 2. Web

- [x] 2.1 Offer the campaign's result types in `KpiTargetDialog` and refresh campaign queries after a save or clear.
- [x] 2.2 Show the campaign's own KPI tile on the campaign page, editable by members who may manage KPIs.
- [x] 2.3 Add `highlightedId` to `PerformanceTable`.
- [x] 2.4 Add the campaign KPI blocks above the project's campaign table, highlighting on hover and focus and opening the campaign on press.

## 3. Verification

- [x] 3.1 Cover the API, the campaign page tile and dialog, the table highlight and the blocks.
- [x] 3.2 Run the tests until green; `openspec validate campaign-kpi --strict`.
