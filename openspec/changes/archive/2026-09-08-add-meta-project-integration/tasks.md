## 1. Connection and credentials

- [x] 1.1 Write and observe failing tests for Account ID normalization, encrypted credential storage, secret-free responses, invalid replacements and project permission/reach checks.
- [x] 1.2 Add the additive integration migration, cipher and configuration, application ports, connection repository and authenticated GET/PUT/DELETE routes; verify account access before saving and queue initial work.
- [x] 1.3 Verify migration preserves populated projects and campaigns, and document safe configuration and credential replacement.
- [x] 1.4 Run `npm test` and `npm run test:web` to green.

## 2. Provider import

- [x] 2.1 Write and observe failing provider tests for fixed-origin pagination, timeouts, redaction, status mapping, account-local date windows, currency checks and daily metrics at all three levels.
- [x] 2.2 Implement the Graph adapter with explicit fields, validated responses, bounded requests, lead/purchase mapping and Decimal monetary handling.
- [x] 2.3 Write and observe failing persistence tests for repeated imports, hierarchy links, absent daily rows, full rollback, foreign-project external IDs and preservation of manual data and older history.
- [x] 2.4 Implement atomic hierarchy and metric import with external ID matching and ownership checks.
- [x] 2.5 Run `npm test` and `npm run test:web` to green.

## 3. Manual and morning jobs

- [x] 3.1 Write and observe failing tests for queued manual requests, competing workers, expired leases, revision fencing, disconnect during import, retries, token expiry, overdue recovery and Warsaw daylight-saving transitions.
- [x] 3.2 Implement durable claims, lease renewal, bounded retries, next-morning calculation and POST sync endpoint.
- [x] 3.3 Wire worker startup and shutdown; verify manual completion preserves the daily schedule and stale work cannot commit after configuration changes.
- [x] 3.4 Run `npm test` and `npm run test:web` to green.

## 4. Project interface and delivery verification

- [x] 4.1 Write and observe failing frontend tests for Account ID and token entry, connection/replacement/disconnect, role gating, safe errors, progress polling and refreshed dashboard data.
- [x] 4.2 Add the integration controls to the project page with Russian localization; submit frontend credentials to the server, clear token state and invalidate existing performance queries after completion.
- [x] 4.3 Update OpenAPI and deployment documentation with endpoint contracts, encryption configuration, Graph version, 30-day import semantics and 08:00 Europe/Warsaw scheduling.
- [x] 4.4 Verify the complete UI flow with synthetic provider fixtures; check that source, logs, API reads and browser persistence contain no real credential.
- [x] 4.5 Run API/frontend builds, `openspec validate add-meta-project-integration --strict`, `npm test` and `npm run test:web` to green.
