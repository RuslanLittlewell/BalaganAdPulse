## Why

A project's campaign table lists every campaign in import order, so the few that are
running now sit scattered among paused and ended ones, and a media buyer has to hunt for
them row by row.

## What Changes

- The project's campaign table gains a «Только активные» switch, on whenever the project
  is opened, that narrows the table to running campaigns — active or learning.
- With the switch off, every campaign is listed, running ones first, each part keeping
  its existing order.
- The table's total row sums the campaigns the table lists, with its ratios derived from
  those sums, instead of repeating the project's total; it is now shown on an advertising
  account's tab as well, totalling that account's campaigns.
- With the switch on and nothing running, the table says that no campaign is running.

## Capabilities

### New Capabilities

### Modified Capabilities
- `campaign-metrics`: a project's campaign table shows running campaigns, first or alone,
  and totals what it lists.
- `meta-project-integration`: an account's tab shows a total row for its campaigns.

## Impact

- `apps/web/src/pages/project/ProjectPage.tsx`, `campaignTone.ts`.
- `apps/web/src/entities/campaign/model/`: the notion of a running campaign and the total
  of a set of campaigns.
- `apps/web/src/shared/config/ru.ts`: the switch label and the empty message.
- No API or schema change.
