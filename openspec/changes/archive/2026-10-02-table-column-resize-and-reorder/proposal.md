## Why

In the performance tables only the name column can be widened; every figure column is a
fixed 128px, so a long label or a large amount is cut while a narrow ratio wastes space.
Their order is also fixed, so a media buyer cannot bring the figures they read first next
to the name.

## What Changes

- Every figure column — the standard metrics and a table's extra columns — gets the same
  resize handle the name column has, by pointer and by keyboard, with a minimum width.
- Hovering or focusing a figure column's header reveals two small triangles that move the
  column one place left or right. The name column stays first and pinned; the first figure
  column cannot move left and the last cannot move right.
- Widths and order are remembered per table in the browser, next to the visible-column
  choice. A column hidden and shown again keeps its place; a column the saved order does
  not know is placed after the known ones.

## Capabilities

### New Capabilities
- `performance-table-columns`: how a member sizes, orders and chooses the columns of a
  performance table, and how that choice is remembered.

### Modified Capabilities

## Impact

- `apps/web/src/widgets/performance-table/PerformanceTable.tsx`, `columnWidths.ts`.
- `apps/web/src/shared/config/ru.ts` — control labels.
- Browser-stored table preferences gain widths per column and an order; existing saved
  name widths and visible columns keep applying. No API change.
