## Why

A campaign's numbers do not belong to the agency — they belong to the ad
platform that ran it. The current campaign sheet asks a media buyer to define
their own columns and type the figures in by hand, which makes every project a
different shape, every formula somebody's private arithmetic, and every number
as fresh as the last person who remembered to update it.

The platforms already publish these figures, with the same names everywhere:
spend, impressions, reach, clicks, conversions, revenue. Reading them directly
gives one shape for every project, numbers that are current, and the level of
detail the platforms actually report at — the ad set and the ad inside a
campaign, which the sheet had no way to express at all.

## What Changes

- **BREAKING**: remove the campaign sheet — user-defined properties, their
  formulas, the daily rows and the values in them — and drop the
  `campaign_property`, `campaign_record` and `campaign_property_value` tables.
  Their data is not recoverable afterwards.
- **BREAKING**: a campaign now names the channel it runs on, its platform
  status, its objective and the platform's own identifier. Campaigns that never
  ran on a channel — the placeholders project creation used to seed so the sheet
  had somewhere to live — go with the sheet, because under this model they are
  not campaigns at all.
- Add the two levels beneath a campaign that the platforms report: ad sets, and
  the ads inside them.
- Store one row of measured figures per entity per day — spend, impressions,
  reach, clicks, conversions, revenue — at each of the three levels.
- Derive every ratio (CTR, CPC, CPM, CPA, ROAS, frequency) rather than storing
  it, so a stored total and a stored ratio can never disagree.
- Read any level over a date range, and read a project or the whole agency as
  the sum of what is beneath it.
- **BREAKING**: creating a project no longer seeds a default campaign; a project
  starts with nothing until a channel is connected.
- Replace the sheet's four permission-matrix resources with one that covers
  everything a campaign now contains.

## Capabilities

### New Capabilities
- `campaign-metrics`: what a campaign, ad set and ad are; the figures measured
  against them; how ratios are derived; and how a range or a parent is
  summarised.

### Modified Capabilities

## Impact

- **Database**: three tables dropped; `campaign` extended; `ad_set`, `ad` and
  three daily-metric tables added.
- **API**: the `records` module and the property half of `campaigns` are
  deleted; campaign read/write, ad-set and ad endpoints replace them.
- **Web**: the campaign sheet, its tabs and its formula editing are replaced by
  the dashboard, project and campaign screens the design describes.
- **Package**: `property`, `record` and `value` leave the permission matrix;
  `campaign` covers the hierarchy.
- Ingestion from the ad platforms is a separate change. This one defines the
  shape the figures land in and reads what is there.
