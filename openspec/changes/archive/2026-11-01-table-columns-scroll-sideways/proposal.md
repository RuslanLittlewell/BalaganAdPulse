## Why

Since `table-columns-fit-container` the performance tables squeeze their figure columns to fit the
container, and widening one column takes the width from the columns to its right. Media buyers
want the earlier behaviour back: each column as wide as they drag it, the name column pinned on the
left, and the table scrolling sideways when it is wider than the page.

## What Changes

- **BREAKING** Figure columns keep their chosen widths whatever the container's width. The table
  scrolls sideways when the columns are wider than the container, and the name column stays pinned
  at its left edge.
- Widening or narrowing a column changes that column alone; the columns to its right keep their
  widths and move along.
- Widths saved while the columns were fitted stay as they were saved.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `performance-table-columns`: the columns no longer fit the container; a wide table scrolls
  sideways, and resizing changes one column only.

## Impact

- `apps/web/src/widgets/performance-table`: `PerformanceTable` and `columnWidths`, with their tests.
- No API change.
