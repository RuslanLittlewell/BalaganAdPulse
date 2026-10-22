## Why

A performance table sums the widths of its visible columns, so adding a few columns, or the
page narrowing when a menu opens and its scrollbar lock takes space, pushes the table wider
than its container and a horizontal scrollbar appears.

## What Changes

- A performance table narrows its figure columns in proportion, down to the minimum column
  width, so the table fits its container and does not scroll sideways.
- Chosen widths are kept: they apply again as soon as the container is wide enough.
- When the columns cannot fit even at the minimum width, the table scrolls sideways as before.

## Capabilities

### New Capabilities

### Modified Capabilities
- `performance-table-columns`: the columns fit the container.

## Impact

- `apps/web/src/widgets/performance-table`.
- No API change.
