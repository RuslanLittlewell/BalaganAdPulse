## Why

A KPI dialog lists the results of each of the campaigns' result types under the bare type name,
so a project with lead campaigns offers «Лиды» twice: once for the leads of every campaign and
once for the results of the campaigns that optimise for leads. The same happens with «Охват».
The list also follows the order the metrics were added in, so a metric is hard to find.

## What Changes

- The results of one result type are labelled «Результаты - <тип>», as the type's column in the
  campaign table is, in the KPI dialogs, on the KPI tile and on the campaign KPI blocks. Their cost
  keeps «Цена · <тип>».
- The metrics of a KPI dialog are listed in alphabetical order of their labels; «Вручную» stays
  last in the project dialog.

## Capabilities

### New Capabilities

### Modified Capabilities
- `result-types`: a KPI on the results of one type is labelled «Результаты - <тип>».
- `kpi-targets`: the KPI dialogs list their metrics alphabetically, each under its own label.

## Impact

- `apps/web/src/features/kpi-target/ui/kpiChoice.tsx`: builds the options with their titles and
  sorts them.
- `apps/web/src/features/kpi-target/ui/kpiTitle.ts`: the title of a typed KPI on results.
- No API or schema change; saved KPIs keep their metric and type.
