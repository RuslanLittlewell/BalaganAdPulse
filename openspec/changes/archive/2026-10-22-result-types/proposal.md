## Why

A project can run campaigns that optimise for different outcomes: one collects messages,
another visits to the profile. The tables add all of them into one «Результаты» figure, so the
number says nothing and the cost per result is a blend of unlike things.

## What Changes

- Each ad set of a Meta campaign records what it optimises for (its optimization goal), kept on
  every import.
- The tables get a «Тип результата» column on campaign, ad set and ad rows (messages, visits to
  the profile, leads, link clicks, and so on).
- Where results of different types would be added together, a campaign row and the «Итого» row
  list them apart, for example «120 сообщений · 45 переходов в профиль», and the cost per result
  is left blank instead of being averaged across types.
- Google campaigns count conversions, so their type is «Конверсии».

## Capabilities

### New Capabilities
- `result-types`: the type of a result, its column, and results listed apart by type.

### Modified Capabilities

## Impact

- `apps/api`: `optimization_goal` on `ad_set`, the Meta importer, campaign / ad set / ad
  responses (`resultTypes`, `resultType`).
- `apps/web`: the «Тип результата» column and the by-type results cell in the performance table.
- Types appear after the next import of an existing project; until then they read «Не определён».
