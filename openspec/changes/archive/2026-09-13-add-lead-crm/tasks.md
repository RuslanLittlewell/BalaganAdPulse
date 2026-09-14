## 1. Lead persistence and board access

- [x] 1.1 Write and observe failing tests for eight stages, board ownership, cross-organization constraints, and the complete role/whole-client/project-only grant matrix.
- [x] 1.2 Add the lead domain, Prisma model, additive migration, board reach port/adapter and shared lead permissions; test migration on populated fixtures and verify existing data survives.
- [x] 1.3 Run `npm test` and `npm run test:web` until both are green.

## 2. CRM REST and audited mutations

- [x] 2.1 Write and observe failing API tests for board enumeration, empty boards, CRUD, field limits, contact round trips, rejected ownership changes and customer/guest/unreachable-board requests.
- [x] 2.2 Implement board and lead repositories, use cases, validation, scoped routes, composition wiring and atomic audit writes.
- [x] 2.3 Write and observe failing tests for same/cross-stage moves, concurrent positioning, failed transaction rollback, confirmed deletion effects and WON producing no client/account/project.
- [x] 2.4 Implement board-scoped locking, atomic ordering, move responses and lead deletion; extend audit reach to CRM including deleted records and client deletion cascade.
- [x] 2.5 Write and observe failing OpenAPI coverage tests, then document every CRM endpoint and error contract.
- [x] 2.6 Run `npm test` and `npm run test:web` until both are green.

## 3. CRM page and lead forms

- [x] 3.1 Write and observe failing UI tests for navigation, eight columns, agency selector placement, customer-only board, whole-client grant filtering, empty/loading/error states and stale board responses.
- [x] 3.2 Implement lead query contracts, board-keyed caches, `/crm` routing, selection URL state and board shell with Russian labels.
- [x] 3.3 Write and observe failing tests for card identity/contacts/source, keyboard opening, validation, retained form values on failure, creation, editing, stage selection and delete confirmation, including read-only guests.
- [x] 3.4 Implement cards and dialogs using existing UI components and styling; add CRM wording to client deletion confirmation and verify customer edit controls match API permissions.
- [x] 3.5 Run `npm test` and `npm run test:web` until both are green.

## 4. Drag interactions and live updates

- [x] 4.1 Write and observe failing tests for pointer/keyboard moves, empty-column drops, optimistic rollback, board switching during a move and contact links not initiating drag.
- [x] 4.2 Implement CRM drag preview, atomic move reconciliation and authoritative recovery while preserving existing task-board interactions.
- [x] 4.3 Write and observe failing tests for commit-only CRM notifications, role/grant revocation, cross-client event exclusion, reconnect recovery, logout cache clearing and stale-event handling.
- [x] 4.4 Add scoped CRM realtime invalidations and selected-board refetch handling; keep task event behavior unchanged.
- [ ] 4.5 Verify desktop and narrow-screen scrolling, long contact values and empty stages, plus two-session live updates and customer isolation; record results and resolve failures.
- [x] 4.6 Run production API/web builds, then `npm test` and `npm run test:web` until both are green.

## 5. Lead attribution and alerts

- [x] 5.1 Write and observe failing tests for a lead naming a project and campaign, a campaign of another project, a project outside the board, releasing a campaign when the project changes, and a deleted project leaving its lead standing.
- [x] 5.2 Add nullable `projectId` and `campaignId` to the lead with an additive migration, board-scoped project reach and campaign validation; drop Telegram from the lead.
- [x] 5.3 Write and observe failing UI tests for the project and dependent campaign selects, and for refusals arriving as an alert rather than as text inside the form.
- [x] 5.4 Implement the selects, the shared alert surface used by the lead form, and the select chevron's spacing.
- [x] 5.5 Run `npm test` and `npm run test:web` until both are green.
