## Context

`resultTypeColumnLabel` names a type's table column «Результаты - <тип>», and `measuredTitle`
uses it for a KPI on a type, so the KPI dialogs, the tile and the campaign KPI blocks read the
same. The metric columns come from `METRIC_COLUMNS`; the KPI metrics take the same `metric.*`
names.

## Goals / Non-Goals

**Goals:**
- Short type names, with the prefix only where a name would repeat.

**Non-Goals:**
- Renaming the metrics themselves, such as «Лиды» for conversions.

## Decisions

- **A collision is with a metric's name.** A type is prefixed when its Russian name equals the
  name of any metric column, whether or not the member shows that column, so the column chooser
  never lists one name twice. Today that is leads and reach. The check reads the names, not a
  fixed list, so a renamed metric or a new type is judged the same way.
- **One rule for the table and the KPIs.** The KPI title keeps using the column's name, so a KPI
  on calls reads «Звонки» in the dialog, on the tile and in the column it is measured against.

## Risks / Trade-offs

- [«Другое» and «Не определён» read vaguely without the prefix] → they appear only when a project
  holds such results, and their place among the result columns tells what they are.
