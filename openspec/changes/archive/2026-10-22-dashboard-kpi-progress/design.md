## Context

`projectTone` already maps a project's progress to none, danger, behind or met with the 70%
and 90% limits, and the project list and the gauge's counts use it. The gauge folds danger
and behind into one "not meeting" count. The performance table can mark a row with a tone and
can show extra columns, but extra columns are hidden by default and format values as counts.

## Goals / Non-Goals

**Goals:** the dashboard speaks the project list's colour language; KPI progress is
sortable in the project table.

**Non-Goals:** changing the zones, the KPI model or the project page's tables.

## Decisions

- **Four gauge parts in arc order:** met, behind (yellow), danger (red), unrated. The needle
  keeps pointing at the met share.
- **The row mark reuses the performance table's tone.** Projects map none to idle, danger to
  danger, behind to stable and met to profitable; the tone labels already speak of KPI.
- **The KPI column is an extra column that can be formatted and shown by default.** An extra
  column may now carry a formatter and may be visible until the member hides it. The value is
  the rounded progress percent, absent when the project has no KPI or no measured figure, so
  it sorts last in both directions and shows a dash.
- **Members who already saved their column choice** keep it; the KPI column appears for them
  from the column chooser.

## Risks / Trade-offs

- The standings keep a `behind` count with a narrower meaning (yellow only); the red group is
  a new `danger` count.
