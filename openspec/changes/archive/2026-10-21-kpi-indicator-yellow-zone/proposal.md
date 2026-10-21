## Why

A campaign's KPI indicator paints a campaign that is slightly behind blue, a colour that
reads as neutral or informative. Media buyers read the three zones as a traffic light:
green needs nothing, yellow asks someone to look closer and help, red calls for urgent
measures. Blue hides the middle zone's warning.

## What Changes

- A running campaign whose KPI progress is from 80% up to 100% is marked yellow instead of
  blue. Green from 100% and red below 80% are unchanged, as is grey.

## Capabilities

### New Capabilities

### Modified Capabilities
- `kpi-targets`: the colour of a campaign's indicator between 80% and 100%.

## Impact

- `apps/web/src/widgets/performance-table/PerformanceTable.tsx`: the middle tone's colour.
- No API, schema or copy change.
