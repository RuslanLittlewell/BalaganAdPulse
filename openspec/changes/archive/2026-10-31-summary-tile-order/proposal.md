## Why

A member picks which figures the period summary shows but cannot say in what order: the
summary always follows the catalogue, so the figure they watch first may sit fourth. They
want to drag the tiles into the order they read them.

## What Changes

- Whoever may change a summary rearranges its tiles by dragging them, or by moving them one
  place at a time with the arrow keys on the tile's handle.
- A project's KPI tile, however many KPI cards it holds, moves as one tile.
- The summary shows tiles in the order they were arranged; a tile added in the dialog goes
  last. Campaign pages follow the project page's order.
- The API keeps the order it is sent instead of sorting the tiles into catalogue order.

## Capabilities

### New Capabilities

### Modified Capabilities
- `summary-tiles`: tiles follow the order the member arranged rather than the catalogue,
  and may be rearranged by dragging or with the keyboard.

## Impact

- `apps/api/src/modules/summary-tiles`: the use case stores the tiles as sent; the catalogue
  sort goes; the OpenAPI description says so.
- `apps/web/src/widgets/agency-overview`: the summary becomes sortable with dnd-kit; the order
  helpers keep the stored order.
- `apps/web/src/features/kpi-target`: a project's KPI cards carry the move handle.
- `apps/web/src/shared/ui`: a move handle shared by the summary and the KPI cards.
- No migration: stored lists keep their current, catalogue, order until rearranged.
