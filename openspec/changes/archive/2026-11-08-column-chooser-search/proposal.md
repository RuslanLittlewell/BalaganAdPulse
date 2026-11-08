## Why

The column chooser of a performance table lists every metric, every result type of the project
and the CRM stage columns, so it no longer fits on screen and a member scrolls to find one
column. A search field lets the member type part of a name and see only the matching columns.

## What Changes

- The Отображаемые столбцы chooser of every performance table opens with a focused search field
  at its top. Typing narrows the list to the columns whose name contains the text, ignoring
  letter case. When nothing matches, the chooser says Ничего не найдено.
- Typing stays in the field instead of jumping to a column that starts with the typed letter,
  and the down arrow moves to the first listed column.
- Turning a column on or off keeps the chooser open with the same text; closing the chooser
  clears it.
- The searchable select used by filters gets the down arrow too, because both now share one
  search field.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `performance-table-columns`: the column chooser can be searched.

## Impact

- Web only: the performance table widget, the shared multi-select and a new shared search field
  for dropdown menus. The search copy reuses the existing `select.search` and
  `select.search.empty` strings.
- No API or database change.
