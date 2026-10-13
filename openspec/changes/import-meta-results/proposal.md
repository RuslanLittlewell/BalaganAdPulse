## Why

Ads Manager's Results column counts what each ad set is optimised for — started
conversations, leads, purchases. The import counts only Meta's `lead` action, so a campaign
optimised for replies shows 2 leads where Ads Manager shows 56 results, and its KPI, tone and
summary are judged on a figure nobody in the agency reads. The account
935203314258513 confirms the Graph API returns Results at every level and per day.

## What Changes

- The Meta import reads the `results` field at campaign, ad-set and ad level, per day, and
  stores it as a new measured figure beside conversions.
- Cost per result is derived from spend and results, never stored, like CPL.
- Results and cost per result become KPI metrics: results with a monthly target, cost per
  result compared as it is and met at or below the target.
- The period summary offers a Результаты tile showing Цена результата, between Лиды and CPC.
- Every performance table offers Результаты and Цена результата columns.
- Leads stay as they are; nothing that reads conversions changes.

## Capabilities

### New Capabilities

### Modified Capabilities
- `meta-project-integration`: the import reads results.
- `campaign-metrics`: results is measured, cost per result is derived, both are shown.
- `kpi-targets`: results and cost per result are KPI metrics.
- `summary-tiles`: the catalogue offers Результаты.

## Impact

- Prisma: a `results` column on the three daily metric tables; `RESULTS` and
  `COST_PER_RESULT` in the `kpi_metric` enum; `RESULTS` in the `summary_tile` enum.
- `apps/api/src/modules/integrations`: reading results. `campaigns`: summing and deriving.
  `kpi`, `summary-tiles`: the new identifiers. OpenAPI documents the new fields.
- `apps/web`: the performance type and totals, table columns, the KPI definitions, the
  summary tile and its catalogue, copy in `ru.ts`.
- Figures already imported read zero results until the next synchronisation, which refreshes
  the last 30 days.
