## Why

Resizing a column of a performance table moves both of its edges: while the columns are narrower
than the table, the browser shares the spare width among all of them, and while they are wider, the
fit narrows every column, so widening one shifts the others. Separately, every advertising account
of a project shares one column layout, although accounts report different results and are read
differently.

## What Changes

- The columns keep exactly the widths chosen; spare width is left after the last column.
- Widening a column while the columns fill the table takes the width from the columns to its right,
  nearest first, down to their minimum, so the column's left edge stays put.
- Each advertising account keeps its own column layout (visible columns, order and widths) for the
  project's campaign table and for the campaign page's ad set table. An account seen for the first
  time starts from the layout the table had before.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `performance-table-columns`: resizing moves one edge only; the fit leaves spare room at the end;
  layouts are kept per advertising account.

## Impact

- Web: `PerformanceTable` (column widths, filler column, `inheritFrom`), `columnWidths` store
  (`setColumnWidths`, `inherit`), project and campaign pages' table keys.
