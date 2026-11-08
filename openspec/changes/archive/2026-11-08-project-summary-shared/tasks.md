## 1. Projects and members store their summary tiles

- [x] 1.1 Add the `SummaryTile` enum, `Project.summaryTiles` (existing projects filled with `CONVERSIONS`, new ones empty) and `Membership.dashboardTiles` (default `CONVERSIONS`) to the Prisma schema with migrations.
- [x] 1.2 Add `project-summary` to the access-policy matrix, updatable by `ADMIN` and `MANAGER`.
- [x] 1.3 Add the `summary-tiles` module: catalogue, use cases for both owners (reach, permission, audit for projects), Prisma repository, routes, schema (at most five, no repeats, catalogue only) and OpenAPI; wire and mount it.
- [x] 1.4 Cover the API: a project created now starts with no tile, a dashboard with `CONVERSIONS`; a manager's project choice is read the same by everyone and stays on its project; guests and customers get 403; an unreachable project 404; six tiles, a repeat, an unknown tile or no list 400; a project change is audited, a dashboard change is not; each member's dashboard is their own. Cover the matrix entry and the mount list.
- [x] 1.5 Run `npm test` until green.

## 2. The web reads and saves tiles on the server

- [x] 2.1 Add the `summary-tiles` entity: uppercase catalogue, calls for both owners, a query and an optimistic, serial mutation that refetches on refusal.
- [x] 2.2 Make `PerformanceSummary` take `tiles` and `onTilesChange`; remove its browser store.
- [x] 2.3 Feed the dashboard from the member's tiles, the project page from the project's (changeable by staff only), the campaign page from its project's; alert when a save is refused.
- [x] 2.4 Cover the widget, the dashboard (server tiles over a stale browser entry, a change saved without touching browser storage, a refusal undone and announced), the project page (a new project shows only the placeholder; staff choose and it is saved; a guest and a client see the project's tiles with no placeholder; a refusal is undone and announced) and the campaign page (the project's tiles).
- [x] 2.5 Run `npm run test:web` until green; `openspec validate project-summary-shared --strict`.
