## Context

`PerformanceSummary` read and wrote its tiles itself, through a persisted zustand store
keyed by user and screen (`dashboard` or `project`), so the project page's choice was one
per person shared by every project, and nothing followed a member to another browser. The
campaign page read the same `project` entry. Tile identifiers were lowercase and existed
only on the web.

A KPI already lives on the server for several owners at once — organization, project and
campaign — through one module whose routes differ only by owner.

## Goals / Non-Goals

**Goals:**
- One choice of tiles per project and one per member's dashboard, both on the server.
- Only staff change a project's tiles, enforced by the API and reflected in the UI.
- No summary tiles in the browser's storage.

**Non-Goals:**
- Pushing a changed project choice live to people who already have the project open; they
  see it on their next load.
- Carrying any browser choice over to the server, or deleting the stale browser entry.

## Decisions

- **A `summary-tiles` module owning the catalogue and both owners**, shaped like the KPI
  module: `GET`/`PUT /api/dashboard/summary-tiles` and `GET`/`PUT
  /api/projects/:id/summary-tiles`, each answering `{ tiles }` in catalogue order. Keeping
  the catalogue in one module avoids the project module and a member module each declaring
  it. Carrying the tiles on the project record was considered: the dashboard would then
  need the catalogue from the projects module.
- **Columns of a `summary_tile` enum array**: `project.summary_tiles`, defaulting to `{}`,
  and `membership.dashboard_tiles`, defaulting to `{CONVERSIONS}`. A new project starts
  bare so its tiles are chosen for it rather than inherited; existing rows are filled with
  `{CONVERSIONS}` when the column is added, so what people already see does not change. The enum makes Postgres
  refuse an unknown tile; the arrays need no join, and their order does not matter because
  the catalogue's order is applied on write and on display. The dashboard belongs to the
  membership rather than the user because a dashboard is one organization's.
- **Tiles are uppercase everywhere** (`SPEND`, `IMPRESSIONS`, `CLICKS`, `CONVERSIONS`,
  `CPC`, `KPI`), as KPI metrics already are, so the web uses the API's identifiers.
- **A `project-summary` resource in the access-policy matrix**, updatable by `ADMIN` and
  `MANAGER`, in the way `project-priority` is. A member's own dashboard needs no entry:
  every member may change it.
- **A project change is audited, a dashboard change is not**, as the project list's
  personal arrangement is not.
- **The summary widget owns no storage.** It receives `tiles` and an optional
  `onTilesChange`; without the callback it shows no placeholder. Pages read the tiles with
  a React Query hook from the `summary-tiles` entity and pass the mutation; the campaign page
  reads its project's tiles with no callback.
- **Saving is optimistic and serial.** The mutation writes the new choice into the query
  cache at once, so the dialog and summary react immediately; mutations for one owner share
  a scope so they reach the server in the order made. A refused save refetches the stored
  choice and raises an alert.
- **Nothing is shown until the tiles arrive**, rather than Лиды first and the stored choice
  a moment later; the placeholder appears with them.

## Risks / Trade-offs

- [Two staff members change one project's tiles at once] → the last save wins, as with any
  other project field.
- [Everyone loses the tiles they had chosen] → stated as breaking in the proposal, as asked.
- [The stale `adpulse-summary-tiles` entry stays in browsers] → nothing reads it; removing it
  would mean keeping browser-storage code alive for no behaviour.

## Migration Plan

Three migrations: the first creates the `summary_tile` enum and adds `project.summary_tiles`
with `{CONVERSIONS}`, which fills every existing project; the second adds
`membership.dashboard_tiles` with `{CONVERSIONS}`, which fills every existing member; the
third changes the project column's default to `{}`, so only projects created afterwards start
bare. No other data changes. Rolling back drops the columns and the
enum; nothing else depends on them.
