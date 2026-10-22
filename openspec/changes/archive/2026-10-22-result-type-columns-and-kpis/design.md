## Context

The previous change gave ad sets a type through their optimization goal and listed results by
type in one cell. Figures are stored per day for campaigns, ad sets and ads; the project and
dashboard KPIs are computed from summed project figures and, for the trend, from per-day sums.

## Decisions

- **Typed days.** One repository read returns, for given campaigns and a range, rows of
  campaign, day, type, results and spend: from ad set days by the ad set's type when the campaign
  has ad sets, from campaign days as conversions for a Google campaign, and from campaign days as
  unknown for any other campaign without ad sets. Every summary sums these rows by type.
- **Figures carry types.** Performance objects returned for campaigns, ad sets, ads, the project
  summary, the dashboard projects and their days carry `resultTypes`: type, results and spend.
  Totals on the web merge them, so per-type cost is spend over results of that type.
- **What a campaign optimises for** is reported apart from the period's figures, as a list of
  types (`resultTypes` on the campaign), so the columns and KPI choices follow the integration and
  not the period.
- **Typed KPI.** A project KPI on results or cost per result may name a result type, stored in
  `project_kpi.result_type`. Its actual value is the type's results, or its spend over results.
  Results stay monthly and prorated; cost stays lower-is-better. Unknown is not offered.
- **Column visibility.** The table remembers which columns it offered when a member last chose
  columns; a column shown by default that was not offered then is shown, so new type columns
  appear without resetting a member's choice.
