## Context

- The leads module stores `lead.stage` (fixed stage or null) and `lead.column_id`, `project_id`, and for Meta leads a `lead_meta_source.submitted_at`. `created_at` of an imported lead is its import time.
- Board reach is resolved by the lead repository: the agency board for staff, client boards for admins and whole-client grants.
- The dashboard project table is `ProjectPerformanceTable`, a wrapper around the shared `PerformanceTable`. The table's visible columns are stored per table key in a persisted zustand store, and default to every metric column when nothing is saved.
- Figures elsewhere use inclusive `from`/`to` calendar days, and the web formats days in UTC.

## Goals / Non-Goals

**Goals:** one request for all dashboard projects' counts; optional columns that start hidden; no leak of lead data across boards.

**Non-Goals:**
- counts for custom columns;
- stage columns on the project or campaign pages;
- totals row or conversion ratios between stages;
- realtime refresh of the dashboard on CRM changes.

## Decisions

### One counting endpoint in the leads module

`GET /api/crm/project-stage-counts?from=YYYY-MM-DD&to=YYYY-MM-DD` returns `[{ projectId, NEW, QUALIFIED, TARGET, PROPOSAL }]` for projects with at least one counted lead. It lives in the leads module because lead reach and stages belong there. The web fills zeros for projects that are absent.

Extending the campaign project summary was rejected: it would make the campaigns module read leads and repeat the request per project.

### Counting query

One grouped query by `project_id` and `stage`, filtered by:
- the actor's organization;
- `project_id` not null and `stage` not null;
- boards the actor reaches: `client_id` null when the agency board is reachable, otherwise `client_id` in the reachable clients;
- arrival in `[from 00:00Z, to + 1 day 00:00Z)`, where arrival is `lead_meta_source.submitted_at` when present and `created_at` otherwise.

Days are UTC to match how the web formats the range. Meta daily figures use the ad account's local day, so a lead near midnight can fall on a neighbouring day compared with the Лиды figure; accepted.

The route reuses the lead `read` permission; reach narrows the rows.

### Optional table columns

`PerformanceTable` accepts `extraColumns`: `{ id, label, format(row) }` with values on each row. The column store treats extra ids as optional: they are valid in a saved list, and absent from the default. A table without a saved list shows the metric columns only, so members who never customised the table see no change. The minimum visible column rule counts extra columns too.

The dashboard project table supplies the four stage columns with labels `CRM · <stage>` from `ru.ts`, and fetches counts once per period with a lead entity query.

## Risks / Trade-offs

- [Counts use current stage, not the stage at the end of the period] → Matches the product decision; a lead moved later changes past periods' counts.
- [A member with a project-only grant sees fewer leads than the table's advertising figures suggest] → Intended: leads on unreachable boards stay private.
- No schema change; no migration.
