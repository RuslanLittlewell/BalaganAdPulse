## Why

The campaign tables now carry a «Тип результата» column, a cost column for every result type and
a «Результаты» cell that turns into a list of types. That is more than the member reads: what is
wanted is the total results and the results of each type, side by side.

## What Changes

- **BREAKING** The «Тип результата» column is removed from the campaign and ad set tables.
- **BREAKING** The «Цена · <тип>» columns are removed.
- Each result type keeps one column, named «Результаты - <тип>», such as «Результаты - Сообщения».
- The «Результаты» cell shows the total number again, also when types are mixed; the
  «Цена результата» cell stays blank where types are mixed.
- KPIs by type are unchanged.

## Capabilities

### New Capabilities

### Modified Capabilities
- `result-types`: the table shows one results column per type and no type or cost-per-type
  columns.

## Impact

- `apps/web`: performance table columns on the project and campaign pages. No API change.
