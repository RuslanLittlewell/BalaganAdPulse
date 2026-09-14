## 1. KPI storage and API

- [x] 1.1 Write and observe failing API tests for the migration leaving existing organizations, projects and campaigns without a KPI, the both-or-neither constraint, cascade with project and campaign deletion, and a Meta import leaving a campaign KPI unchanged.
- [x] 1.2 Add the `kpi_metric` enum and nullable KPI columns with an additive migration; apply it to a copy of the populated development database and verify existing data survives.
- [x] 1.3 Write and observe failing API tests for reading, setting, replacing and clearing organization, project and campaign KPIs; independent levels; invalid metric and target; reach 404; role 403 including customers, guests and managers on the organization KPI; and audit events with before and after values.
- [x] 1.4 Implement the `kpi` module, its routes, composition wiring and OpenAPI documentation.
- [ ] 1.5 Run `npm test` and `npm run test:web` until both are green.

## 2. KPI progress model on the web

- [x] 2.1 Write and observe failing unit tests for monthly proration over a full month, a week and a period across two months; ratio targets as they are; lower-is-better metrics; percent and met, behind and unmeasured states.
- [x] 2.2 Implement the KPI entity: metric catalogue, progress calculation, API client and queries.
- [ ] 2.3 Run `npm test` and `npm run test:web` until both are green.

## 3. Configurable summary

- [x] 3.1 Write and observe failing web tests for the default Лиды tile and placeholder; the dialog title, thumbnails, `aria-pressed` selection, counter, limit of five with disabled thumbnails; immediate application in catalogue order; removing every tile; per-screen and per-person memory surviving reload; and KPI offered per screen and role with stored unavailable tiles ignored.
- [x] 3.2 Implement the tile layout store, placeholder, selection dialog and catalogue in `PerformanceSummary`, with Russian copy in `ru.ts`.
- [ ] 3.3 Run `npm test` and `npm run test:web` until both are green.

## 4. KPI tile and target dialog

- [x] 4.1 Write and observe failing web tests for the KPI tile showing metric, actual, period target, percent, progress and state; no target with and without edit rights; opening the target dialog, the monthly or as-is hint, saving, replacing and clearing; and read-only readers.
- [x] 4.2 Implement `KpiTile` and `KpiTargetDialog` and wire the dashboard, project and campaign pages with their screen, range and KPI scope.
- [ ] 4.3 Run production API and web builds, then `npm test` and `npm run test:web` until both are green.
