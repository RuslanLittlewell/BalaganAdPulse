## 1. Stages, columns and migration

- [x] 1.1 Write and observe failing tests for the migration moving leads from removed stages to the end of `NEW` in order, keeping `QUALIFIED` and `PROPOSAL` leads, rebuilding the enum, and for `lead_column` uniqueness, the stage-or-column check, restricted column deletion and cascade with the board's client.
- [x] 1.2 Add the migration and Prisma schema changes; apply the migration to a copy of the populated development database and verify every lead survives with contiguous positions.
- [x] 1.3 Run `npm test` and `npm run test:web` until both are green.

## 2. Columns API and lead placement

- [x] 2.1 Write and observe failing API tests for listing fixed and custom columns, creating, renaming, moving and deleting columns with name, duplicate, limit and fixed-stage refusals, deleting a column moving its leads to the end of Новый, creating and moving leads into custom columns, refusing another board's column, permissions for customers and guests, audit events and realtime notifications.
- [x] 2.2 Implement the column repository, use cases, routes and OpenAPI; accept custom column ids as `stage` in lead create, update and move; update board ordering.
- [x] 2.3 Run `npm test` and `npm run test:web` until both are green.

## 3. CRM board interface

- [x] 3.1 Write and observe failing web tests for the four fixed stages with their Russian names, custom columns after them, the placeholder creating a column, renaming, moving left and right, deleting with a lead-count confirmation, hidden management for guests, moving cards into custom columns, and the lead form stage choice listing every column.
- [x] 3.2 Implement the column queries, board rendering, placeholder, name dialog, column menu, ordering helpers and stage select; update Russian copy.
- [x] 3.3 Run production API and web builds, then `npm test` and `npm run test:web` until both are green.
