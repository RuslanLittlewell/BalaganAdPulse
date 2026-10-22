## Why

A project's campaigns collect different kinds of results, and a single «Результаты» column,
even listed apart in one cell, is hard to read and cannot be sorted or compared per kind. The
KPI also can only aim at all results together, so a project cannot set a target for messages
alone or for the cost of a profile visit.

## What Changes

- The campaign tables get a pair of columns for each result type the project's campaigns
  optimise for: the count («Сообщения») and its cost («Цена · Сообщения»). The columns follow
  the types present in the project's integration, not only in the chosen period.
- Results and spend are read per type and per day, so the columns, the totals and the KPI use
  the same figures.
- A project KPI can aim at the results of one type or at their cost, in addition to the existing
  metrics. The KPI dialog offers the types the project's campaigns have.
- Columns that appear for the first time are shown even to a member who has already chosen
  which columns to see.

## Capabilities

### New Capabilities

### Modified Capabilities
- `result-types`: types reported with figures per period, columns per type, typed KPIs.

## Impact

- `apps/api`: figures by type on campaigns, ad sets, ads, project summaries and their days;
  `result_type` on `project_kpi`; KPI progress and the KPI-met notification by type.
- `apps/web`: per-type columns, typed KPI choices, labels and progress, column visibility.
