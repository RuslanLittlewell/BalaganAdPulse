## 1. Counts API

- [x] 1.1 Write and observe failing API tests for counts per project and fixed stage by arrival within an inclusive UTC range, current-stage counting after a move, Meta leads counted by submission time, exclusion of custom-column and unattributed leads, board reach for customers and project-only grants, isolation from other organizations, 400 for missing, malformed or reversed ranges, and the OpenAPI entry.
- [x] 1.2 Implement the counting repository query, use case, route, request schema and OpenAPI entry.
- [x] 1.3 Run `npm test` and `npm run test:web` until both are green.

## 2. Dashboard project table

- [x] 2.1 Write and observe failing web tests for the dashboard project table offering the four CRM stage columns hidden by default, showing per-project counts with 0 when absent after turning a column on, requesting the selected period, remembering the choice, and the project campaign table offering no CRM stage columns.
- [x] 2.2 Implement the counts query, optional extra columns in the performance table and its column store, and the stage columns with Russian labels in the dashboard project table.
- [x] 2.3 Run production builds, then `npm test` and `npm run test:web` until both are green.
