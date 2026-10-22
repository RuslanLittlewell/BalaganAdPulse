## Context

Metrics are stored per day for campaigns, ad sets and ads, with one `results` number each. Meta's
`results` for an ad set counts the outcome the ad set is optimised for, so the number already
means «messages» for one ad set and «profile visits» for another; only the meaning is lost.

## Decisions

- **The type comes from the ad set's `optimization_goal`.** It is a documented enum, unlike the
  `indicator` strings of the insights `results` field. Goals are grouped into a small set of
  types (messages, profile visits, leads, link clicks, landing page views, conversions,
  engagement, reach, video views, app installs, other); a missing goal is «unknown».
- **Types are read, not stored on metrics.** An ad set and its ads take the type of the ad set. A
  campaign lists, per type, the results its ad sets produced in the period, from the ad sets'
  daily metrics. A Google campaign has one type, conversions, and its results are the campaign's.
- **Totals list by type.** The web merges the campaigns' lists. A single type behaves as today;
  two or more replace the cell's number with the list and blank the cost per result.
- **Re-import fills the gap.** Existing ad sets have no goal until their project is imported
  again; their results are listed under «unknown».
