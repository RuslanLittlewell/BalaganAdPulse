## Context

A project's KPI lives in columns of the project row. The summary of projects, the campaign
indicator and the KPI-met notification all read that one KPI. Organization and campaign KPIs
are columns of their own rows and stay as they are.

## Decisions

- **A table for project KPIs.** `project_kpi` holds the project, a position, the metric, the
  target, the by-hand name and value, an enabled flag and the update time. The existing
  project columns are copied into it as position 0, enabled, and then dropped.
- **The list is replaced as a whole.** The dialog edits several blocks at once, so the API
  reads a list and replaces a list: one request saves added, changed, switched and removed
  KPIs in order. One audit event records the list before and after. At most five KPIs; more is
  a 400.
- **Each KPI keeps its place.** Positions follow the order of the list, so tiles and blocks
  keep the order the member chose.
- **The project's result is the least-met enabled KPI.** It is the lowest percentage, so a
  problem project cannot hide behind a goal that is easy to meet. Disabled KPIs are ignored
  everywhere the result is used. Wherever a figure was not measured, that KPI is skipped, and
  when none can be measured the project is unrated.
- **The campaign indicator follows the same rule for the project's stand-in.** A campaign's own
  KPI wins; otherwise the least-met enabled project KPI measured by figures counts, and one set
  by hand never does, as before.
- **The KPI-met notification fires when every enabled KPI is met** for the month so far, at
  most once a month, as before.
- **The KPI summary tile expands.** The tile still takes one place among the chosen tiles; on a
  project it shows one card per KPI. A project without a KPI shows the one empty card.
- **The dialog.** The blocks are the project's KPIs followed by one empty block. A block left
  empty is ignored on saving; the empty block fills up to the limit. Removing a block removes
  its KPI on saving. Organization and campaign dialogs are unchanged.
