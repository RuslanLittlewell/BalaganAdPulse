## 1. Stage history

- [x] 1.1 Prisma: `lead_stage_change` with an index on `processed_at` and an index on project and time; the migration backfills creations and moves from `audit_event` as processed rows, as the design describes
- [x] 1.2 Record a stage change in the same transaction on manual creation, Meta import, a move to another stage and column deletion; none for a reorder within a stage
- [x] 1.3 Cover the four recording points, the reorder case and the backfill (creation with and without an audit entry, moves, a deleted lead) with tests; `npm test` and `npm run test:web` green

## 2. Conversion events

- [x] 2.1 Prisma: `crm_conversion_event` with `name_key` unique per project
- [x] 2.2 Domain and use cases: create, edit, delete and list events under the `integration` permission and project reach; name length and uniqueness ignoring case; one or more stages of the project's own board; at most 10; audit entries
- [x] 2.3 Column deletion removes the column from every event's stages in its transaction
- [x] 2.4 The reaching query: for a batch of stage changes, the events each one reaches for the first time under the events' current stages
- [x] 2.5 Routes in the leads router, Zod schemas and OpenAPI
- [x] 2.6 Cover the event rules, 403 for clients and guests, 404 for unreachable projects, column deletion and the reaching query (back and forth, skipped stages, a stage added later) with tests; `npm test` and `npm run test:web` green

## 3. Dataset connection

- [x] 3.1 Prisma: `meta_dataset` and `meta_conversion_send` with the unique index on lead and event
- [x] 3.2 A Conversions API client in the new `conversions` module: dataset check by `GET /{dataset_id}`, event posting with the lead ID kept exact in the JSON, hashing and normalisation of phone and email, and error classification into auth, refused and temporary
- [x] 3.3 Cover the client with recorded responses: the body of a sale, a 17-digit lead ID, hashes, test code, each error class
- [x] 3.4 Use cases: connect, replace the token, change the code and currency, disconnect (dropping waiting sends, keeping the rest); token check before saving, encryption, audit without the token; catch-up of the last seven days on connect
- [x] 3.5 `GET`, `PUT`, `DELETE /api/projects/:id/conversions-api` with the counts by the Meta account's time zone and the 20 latest sends; Zod schemas and OpenAPI
- [x] 3.6 Cover connection, refusal, replacement without a token, permissions, disconnect, catch-up (five recent and two old reached events) and the counts with tests; `npm test` and `npm run test:web` green

## 4. Sending

- [x] 4.1 Worker step one: claim unprocessed stage changes with `SKIP LOCKED`, queue sends for Meta form leads of projects with a dataset, mark them processed
- [x] 4.2 Worker step two: expire old unsent rows, claim a dataset under a lease with revision, send due rows in batches of 100, hold amount-carrying events until an amount or 72 hours, apply the error rules and the retry steps
- [x] 4.3 Start and stop the worker with the server, next to the lead poll worker
- [x] 4.4 Cover with tests: a form lead reaching an event is sent once, a manual lead is not, the amount hold both ways, a revoked token and its replacement, expiry after seven days, a refused event inside a batch, two workers on the same rows; `npm test` and `npm run test:web` green

## 5. Web

- [x] 5.1 API client and React Query hooks for the conversion events and the Conversions API endpoints
- [x] 5.2 The Conversions API panel in the «Интеграции» block: titled by the Meta logo and «Conversions API», shown only with a Meta connection and the integration permission; dataset form with state and test mode notice; disconnect
- [x] 5.3 Event list and editor: name, stages from the board's columns, «С суммой», no-stages mark, the hint about the «Новый» stage
- [x] 5.4 Delivery: counts for today, 7 and 30 days and the 20 latest sends with their states and reasons; refetch every 30 seconds while open
- [x] 5.5 Russian copy in `ru.ts`
- [x] 5.6 Cover the panel with tests: who sees it, connecting and the error shown on refusal, editing an event, the states and reasons listed, the test mode notice; `npm test` and `npm run test:web` green

## 6. Close

- [x] 6.1 Describe the Conversions API setup for a client (where to create the token in Events Manager, test events) in the README
- [x] 6.2 Run `npm test`, `npm run test:web` and the type-checks until green; `openspec validate meta-crm-conversions --strict`
