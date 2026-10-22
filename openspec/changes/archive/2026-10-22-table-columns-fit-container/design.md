## Context

The table is `table-layout: fixed` and its width is the sum of the name column, the figure
columns and a fixed trailing column. The container is the scroller, so any excess becomes a
horizontal scrollbar.

## Decisions

- **Measure the scroller, not the window.** The container's inner width is observed, so the
  table follows any change of it, including the one a menu's scroll lock causes.
- **Shrink only the figure columns.** The name column keeps its chosen width. Figure columns
  are scaled in proportion to their chosen widths and floored at the minimum.
- **Nothing is saved.** Fitting is a display-time calculation; stored widths are untouched,
  so widening the window restores them. Resizing a narrowed column starts from the width shown.
