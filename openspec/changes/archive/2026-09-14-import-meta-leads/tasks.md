## 1. Leads and CPL labels

- [x] 1.1 Write and observe failing web tests for Лиды and CPL in the performance table header and column chooser, the performance summary and the daily chart, and for a previously hidden conversions column staying hidden.
- [x] 1.2 Change the `metric.conversions` and `metric.cpa` values in `ru.ts`, keeping column ids and API field names.
- [x] 1.3 Run `npm test` and `npm run test:web` until both are green.

## 2. Lead origin, source and ledger persistence

- [x] 2.1 Write and observe failing API tests for lead origin defaulting to manual on existing rows, the ad link released when an ad is deleted, the Meta source cascading with its lead, and the ledger keeping a Meta lead key after its lead is deleted.
- [x] 2.2 Add the `lead_origin` enum, `lead.origin`, `lead.ad_id`, `lead_meta_source` and `meta_lead` with an additive migration; apply it to a populated test database and verify existing leads, campaigns and integrations survive.
- [x] 2.3 Write and observe failing API tests for lead responses carrying `origin`, `ad` and `metaSource`, for refusing a changed project or campaign on an imported lead, and for accepting a save that repeats them.
- [x] 2.4 Extend the lead repository, domain types, schemas, update use case and OpenAPI contract accordingly.
- [x] 2.5 Run `npm test` and `npm run test:web` until both are green.

## 3. Lead intake into the client board

- [x] 3.1 Write and observe failing API tests for intake: placement last in `NEW` on the project client's board, no agency or other-client placement, a repeated Meta lead skipped, concurrent intake producing one lead and contiguous positions, no member audit event, and a `crm.changed` event after commit only.
- [x] 3.2 Implement the leads-module intake service with an actor-free board lock, ledger insert with conflict skip, source write and board result, and wire it to a `LeadInbox` port in composition.
- [x] 3.3 Write and observe failing tests for field mapping: full name, first and last name, phone/email/identifier name fallbacks, work phone and email fallbacks, invalid or oversized values dropped from contact fields, answer order, 100-answer and 10000-character bounds with the omitted flag.
- [x] 3.4 Implement the field mapper using the lead field schemas.
- [x] 3.5 Write and observe failing tests for attribution: campaign and ad linked when imported, linked after a later snapshot commit when missing, links released on local removal while Meta names remain.
- [x] 3.6 Implement attribution resolution at intake and the post-snapshot linking statement.
- [x] 3.7 Run `npm test` and `npm run test:web` until both are green.

## 4. Graph provider lead reads

- [x] 4.1 Write and observe failing provider tests with fixtures for listing live ads filtered to lead objectives, reading `/{ad_id}/leads` with the `time_created` filter and cursor pages, payload validation, and error classes: 190/102 as token, 10 and 200–299 as access, rate-limit and transient codes as provider with Retry-After.
- [x] 4.2 Implement `liveLeadAds` and `leads` in `GraphProvider` with a lead-specific classification and the new `ACCESS` error code, logging only codes.
- [x] 4.3 Run `npm test` and `npm run test:web` until both are green.

## 5. Lead poll scheduling and worker

- [x] 5.1 Write and observe failing tests for the lead-poll migration defaults on existing integrations, claiming only connections with a successful advertising import and without `AUTH_REQUIRED`, one owner across competing claims, and a lead poll proceeding while a snapshot lease is held.
- [x] 5.2 Add the lead-poll columns and index with an additive migration and implement lead job claim, renew, complete and fail against the separate lease and credential revision.
- [x] 5.3 Write and observe failing worker tests for the seven-day first window, coverage advancing only on commit with a ten-minute overlap, catch-up after an outage, the daily sweep over ads with recent conversions, manual refresh queueing a poll, access refusal leaving advertising status untouched with hourly retry and recovery, token rejection moving to credential replacement, and disconnect or replacement during a poll creating nothing.
- [x] 5.4 Implement `createLeadPollWorker`, the sweep trigger after snapshot commit, manual refresh queueing, coverage preservation for same-account replacement and reset for a different account; start and stop it with the server.
- [x] 5.5 Write and observe failing API tests for the integration read exposing lead status, last success and safe error only to members with project update permission.
- [x] 5.6 Extend the integration read, public mapping and OpenAPI contract.
- [x] 5.7 Run `npm test` and `npm run test:web` until both are green.

## 6. CRM and integration interface

- [x] 6.1 Write and observe failing web tests for the imported lead dialog source section (account, form, campaign, ad set, ad, submission time, answers, omitted notice), read-only project and campaign selects, editable contacts and notes, no source section on manual leads, and guest read-only behaviour.
- [x] 6.2 Implement the lead entity types and the source section in the lead dialog with Russian copy in `ru.ts`.
- [x] 6.3 Write and observe failing web tests for the card showing `Meta · <campaign name>` without source text, Не указан for manual leads, and opening the creative preview from an imported lead linked to an ad.
- [x] 6.4 Implement the card source label and the `onPreviewCreative` callback composed with `CreativePreviewDialog` in `CrmPage`.
- [x] 6.5 Write and observe failing web tests for the Meta integration panel showing lead status, last lead poll time, access-required guidance and safe errors.
- [x] 6.6 Implement the lead status display in `MetaIntegration`.
- [x] 6.7 Run production API and web builds, then `npm test` and `npm run test:web` until both are green.

## 7. Live verification

- [ ] 7.1 With a test Page, Instant Form and a token holding the required permissions, submit a test lead and record that it reaches the client board within fifteen minutes with correct contacts, source and creative preview; then revoke lead access and record the access-required status and recovery.
