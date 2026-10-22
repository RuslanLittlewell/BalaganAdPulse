## Context

The summary already returns each project's figures for every day of the period. The KPI
progress for the period is computed from the period's totals by the same function the KPI
tile uses.

## Decisions

- **Cumulative progress.** For each day with figures, progress is computed from the totals
  from the start of the period up to that day, against the target for the same stretch of
  days. The last point equals the progress shown in the Выполнение KPI column, so the chart
  and the figure always agree. A single day's figure would swing with weekends and say
  nothing about the plan.
- **Same function as the tile.** Ratios such as CPL are derived from the cumulative sums, and
  lower-is-better metrics are counted in their favourable direction.
- **No chart without a measurable trend.** A manual KPI has no daily figures, and a day whose
  figure is not measured is skipped.
