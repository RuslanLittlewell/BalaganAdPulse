## Context

The project page receives the project's campaigns ordered by `position`, which the Meta
import assigns in the order the Graph API returns them. The page already narrows them
to one advertising account when there are several and hides the total row in that case,
because the project summary it shows there would no longer match the rows. Which
statuses count as running is decided in `campaignTone.ts`, local to the page.

## Goals / Non-Goals

**Goals:**
- Narrow and order the project page's campaign table by running status.
- One definition of a running campaign for the indicator and the table.

**Non-Goals:**
- Ordering or narrowing ad sets and ads on the campaign page.
- Remembering the switch between projects or visits.
- Reworking the agency summary's own adding up of figures across currencies.

## Decisions

- **Narrow and order in the page, not the API.** The listing endpoint keeps returning
  every campaign by `position`; other readers rely on that order, and a project page
  that can show all campaigns needs them all anyway. Ordering by status in SQL would
  also rank paused against ended, which nobody asked for.
- **A running campaign is defined once, in the campaign entity.** `isRunning` moves next
  to `statusTone`, and the indicator and the table both use it, so a learning campaign
  can never be grey yet shown, or coloured yet hidden.
- **The switch is page state, reset per project**, in the way the chosen account is
  already reset, since it must be on whenever a project is opened.
- **The total row is summed in the browser from the rows the table lists.** Each
  campaign already carries its figures for the period, and the project summary is the
  sum of those same campaign figures, so summing the listed campaigns and deriving the
  ratios from the sums gives exactly the project's total when nothing is hidden. The
  derivation repeats the API's `derive` formulas in `totalPerformance` in the campaign
  entity. Alternatives: hiding the row whenever a campaign is hidden, which left most
  projects without a total by default; keeping the project's total, which would not
  match the rows above it; or a filtered summary endpoint, an API change for figures
  the page already holds.
- **Reach is added up across campaigns**, as the project summary already adds it, so an
  account's tab now shows a totals row as well.

## Risks / Trade-offs

- [The browser's ratio formulas could drift from the API's] → both are six one-line
  ratios, and a test pins the total against hand-computed figures.
- [Status is the campaign's status now, not over the chosen period, so a campaign that
  spent last month but is paused today is hidden from that month's table] → turning the
  switch off shows it.
