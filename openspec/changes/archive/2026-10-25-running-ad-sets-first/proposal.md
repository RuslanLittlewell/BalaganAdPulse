## Why

A project's campaign table can show only the running campaigns, but a campaign's ad set table
always lists every ad set and ad, so paused and ended ones crowd out the ones that spend.

## What Changes

- The campaign page offers a «Только активные» switch above its ad set table, on whenever a
  campaign is opened. While on, only running ad sets, and within them only running ads, are
  listed; while off, everything is listed, running ones first.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `campaign-metrics`: the campaign page's ad set table shows running ad sets and ads first or
  alone.

## Impact

- Web: `CampaignPage` filters and orders ad sets and ads; `ru.ts` gains the empty text.
