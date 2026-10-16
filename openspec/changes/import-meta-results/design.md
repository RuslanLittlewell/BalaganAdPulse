## Context

A day's figures travel from `GraphProvider.metrics` as an `ImportedMetric`, are written by
`PrismaImportJobs` by spreading the metric into a row of `campaign_daily_metric`,
`ad_set_daily_metric` or `ad_daily_metric`, are read and summed into `Measured` and derived
into `Performance` by the campaigns module, and reach the web unchanged in shape. The web
repeats the derivation in `totalPerformance` for the rows a table lists, and lists the table
columns in `METRIC_COLUMNS`. KPI metrics are an enum on the API and in Postgres, with a
definition table on the web that decides format, monthly targets and direction. Summary
tiles are an enum on the API and in Postgres and a catalogue on the web.

Meta's Insights `results` field is a list of `{ indicator, values: [{ value,
attribution_windows }] }`; for the account checked it holds one indicator,
`actions:onsite_conversion.messaging_conversation_started_7d`, at every level and per day.

## Goals / Non-Goals

**Goals:**
- Results measured per day at every level, summed and derived like every other figure.
- One identifier for each new figure from the import to the screen.

**Non-Goals:**
- Showing what kind of result a campaign counts; the indicator is not stored.
- Replacing leads with results anywhere leads are used today, including monthly reports
  and lead alerts.
- Results from channels other than Meta; other channels record zero.

## Decisions

- **`results` is an `Int` column, default 0, on the three daily tables.** It travels
  through `ImportedMetric` and the existing spread, so the writer needs no change. A
  fractional value is rounded to the nearest whole result rather than refused, because a
  refused value would fail the whole import; Ads Manager also shows whole results.
- **Results are requested apart from the other figures**, as a second Insights request per
  level with only `<level>_id,date_start,results`, and joined to the figures of the same
  entity and day; a day the second request does not mention has zero results. Asking for
  `results` together with the other figures made Meta answer the ad-level request of the
  checked account with error 2 after 30 seconds at a page of 500 rows, and take 37 seconds
  at 100; the request for results alone answered in under two seconds at any page size,
  and the request for the other figures alone keeps its previous cost.
- **Every indicator's default-attribution value is summed.** A row normally reports one
  indicator; when an ad set reports several, the sum is what the row achieved toward its
  goals, and the project and agency totals already sum across campaigns with different
  goals in the same way.
- **Cost per result is derived** as spend ÷ results in `derive` and in the web's
  `totalPerformance`, absent when there is no result. Storing Meta's `cost_per_result`
  would put a ratio in storage, which the metrics spec forbids, and could contradict the
  summed figures.
- **Wire names `results` and `costPerResult`**, KPI identifiers `RESULTS` and
  `COST_PER_RESULT`, tile identifier `RESULTS`. Postgres enums gain the values with
  `ALTER TYPE … ADD VALUE`; the catalogue order lives in code.
- **The tile sits between Лиды and CPC** in the catalogue so the two lead-like figures are
  adjacent; the five-tile limit is unchanged.
- **This change is archived after `project-summary-shared`**, whose version of the
  summary-tiles requirements its delta builds on.

## Risks / Trade-offs

- [Results of different kinds are added across campaigns] → the same holds for Ads Manager's
  account totals; the KPI and the campaign tone, which matter most, are per campaign.
- [History reads zero results until the next import] → the next synchronisation refreshes
  the last 30 days; older history keeps zero, stated in the proposal.
- [Meta renames or drops `results`] → the field is optional in the parser, so the import
  keeps working with zero results instead of failing.
- [Six Insights requests per import instead of three] → the three added ones are the
  lightest of all; the ad-level request for the other figures, which already takes 14–21
  seconds on the checked account against a 30-second timeout, is unchanged.

## Migration Plan

One migration adds `results INTEGER NOT NULL DEFAULT 0` to the three daily metric tables
and adds `RESULTS` and `COST_PER_RESULT` to `kpi_metric` and `RESULTS` to `summary_tile`.
Existing rows keep their figures and read zero results. Rolling back drops the columns;
enum values cannot be dropped in place, so a rollback leaves them unused.
