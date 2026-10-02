## Context

`PerformanceTable` lays out a fixed table: the name column's width comes from a persisted
zustand store (`useColumnWidths`, `nameWidths` per table), figure columns get an implicit
128px, and the column set comes from `visibleColumnIds`. The name column's header carries
a pointer and keyboard `separator`.

## Goals / Non-Goals

**Goals:**
- Resize any column; reorder figure columns; remember both per table.

**Non-Goals:**
- Moving the name column, which is pinned to the left edge.
- Drag-and-drop reordering of headers.
- Server-side storage of table preferences.

## Decisions

- **One resize handle component for all columns.** The existing name separator becomes a
  `ColumnResizer` taking the width, minimum, label and setter, so every header gets the
  same pointer and keyboard behaviour.
- **Store widths as `columnWidths[tableKey][columnId]`, keep `nameWidths` as it is.**
  The name column keeps its own key and minimum, so saved name widths survive without a
  storage migration. Figure columns default to 128px with a 72px minimum.
- **Store order as `columnOrder[tableKey]`, a list of figure column ids.** The rendered
  order is the saved order filtered to the visible columns, followed by visible columns
  the saved order does not know, in their default order. Hiding a column never rewrites
  the order, so it comes back where it was.
- **Moves swap with the visible neighbour.** Moving is computed over the visible columns
  and written back as a full order, so a hidden column between two visible ones does not
  make a click appear to do nothing.
- **Header buttons sit inside the header cell, revealed on hover and focus-within.** The
  header keeps its column label as its accessible name through `aria-label`, so the
  buttons' labels do not leak into it.

## Risks / Trade-offs

- [The table grows wider as columns widen] → the table already scrolls horizontally and
  its width is computed from the column widths.

## Migration Plan

Persisted store version stays readable: new fields default to empty records.
