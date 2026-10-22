## Why

The KPI dialog added an empty block the moment the previous one was filled, which moved the
dialog under the member's hands, and a switched-off KPI was shown by dimming its whole tile,
which made it hard to read.

## What Changes

- The dialog adds a block only when the member presses a plus button below the blocks.
- A KPI tile and its preview carry a small circle at the top left: green when the KPI counts
  toward the project's result, grey when it does not. A switched-off tile is no longer dimmed
  and keeps its figures and status.

## Capabilities

### New Capabilities

### Modified Capabilities
- `kpi-targets`: the dialog's add control and the tile's counted indicator.

## Impact

- `apps/web/src/features/kpi-target`, `apps/web/src/shared/config/ru.ts`.
- No API change.
