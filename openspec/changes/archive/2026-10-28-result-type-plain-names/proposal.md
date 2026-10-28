## Why

Every column of a result type is called «Результаты - <тип>», so a Google campaign's table reads
«Результаты - Звонки», «Результаты - Контакты», «Результаты - Маршруты»: the prefix repeats on
every column although only «Лиды» and «Охват» need it, to stand apart from the metric columns of
the same name.

## What Changes

- A result type's column, and its entry in the KPI dialogs, its KPI tile and its campaign KPI block,
  is named by the type alone, as «Звонки».
- Only a type whose name a metric already carries keeps the prefix: «Результаты - Лиды» beside
  «Лиды», «Результаты - Охват» beside «Охват».
- Column ids are unchanged, so a member's chosen columns, widths and order survive.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `result-types`: the name of a type's column and of a KPI on a type.

## Impact

- Web: `entities/campaign` (the type column's name), which the table and the KPI titles use.
- No API or schema change.
