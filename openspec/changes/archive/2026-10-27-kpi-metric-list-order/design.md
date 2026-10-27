## Context

`MeasuredChoices` renders the metric list of both KPI dialogs: the metrics of `KPI_METRICS` in
their declared order, then, for each result type of the campaigns, the results and the cost of
that type. The results of a type take the type's bare name, which repeats «Лиды» (the general
conversions metric) and «Охват». `kpiTitle` names a saved KPI on its tile and on the campaign KPI
blocks with the same rule.

## Goals / Non-Goals

**Goals:**
- No two entries of the list share a label, and a tile names its KPI as the list does.
- The list is in alphabetical order.

**Non-Goals:**
- Renaming the general metrics or the cost of a type.
- Grouping the list under headings.

## Decisions

- **The results of a type read «Результаты - <тип>».** It is the label the type's column already
  has in the campaign table, so a member meets one name for one figure. Alternative: renaming the
  general «Лиды», which would leave «Охват» doubled and split the name from the table's «Лиды».
- **One title for the list and the tile.** `kpiTitle` gains a `measuredTitle(metric, resultType)`
  that both the list and the tile call, so they cannot drift apart.
- **Sorted with the Russian collation.** Labels are compared with `localeCompare(…, "ru")`, which
  puts Cyrillic before Latin, so the abbreviations CPC, CPL, CPM, CTR and ROAS close the list.
  «Вручную» is not a measured metric and stays after them in the project dialog.

## Risks / Trade-offs

- [Members used to the old order look for a metric in its old place] → the list is short and
  alphabetical order is what they will look for next.
