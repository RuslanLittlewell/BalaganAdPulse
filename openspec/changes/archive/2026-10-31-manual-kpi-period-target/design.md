## Context

Monthly metrics recalculate their target for the period in `targetForRange`, on the web for
the tiles and on the server for the month's KPI check. A KPI set by hand skips it on both.

## Goals / Non-Goals

**Goals:**
- A target set by hand that follows the period like a monthly metric's.

**Non-Goals:**
- Recalculating the value, which members enter for whatever span they track.
- A choice per KPI between a monthly target and a fixed one.

## Decisions

- **Share the day-by-day recalculation.** `targetForRange` gains a `monthlyTarget(target,
  range)` that both monthly metrics and KPIs set by hand use, on the web and on the server,
  so the tile, the project marker and the KPI notification agree.
- **Sum by month, not by day.** Adding `target / days in month` once per day drifts: a whole
  September gave 49.999… for 50, so a value of 50 read as exceeded rather than met. Counting the
  period's days in each month and adding `target × days / length` gives whole months exactly,
  for monthly metrics as well.
- **A recalculated target set by hand is shown to hundredths**, while its value keeps the four
  places it was entered with.
- **REMOVED and ADDED rather than MODIFIED.** The old requirement's scenario "The period does
  not matter" states the opposite of the new rule, and a modification may not drop a scenario.

## Risks / Trade-offs

- [A value entered for the whole month looks exceeded on a short period] → the dialog now says
  the target is monthly and recalculated; the value is what the member says it is.
- [The month's KPI check may find a KPI set by hand met earlier in the month] → it already does
  so for monthly metrics, whose targets are recalculated for the month so far.
