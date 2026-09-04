## 1. Invitation Data Model

- [x] 1.1 Add failing Prisma/repository tests for typed invitations, project relations, pending-only listing, type filtering, and preservation of historical rows.
- [x] 1.2 Add the invitation type and invitation-project Prisma models plus a migration that preserves existing rows and makes legacy invitations historical.
- [x] 1.3 Update the invitation domain model and repository ports/adapters for nullable roles, project ids, typed creation, and pending-only queries.
- [x] 1.4 Run `npm test` and restore a green backend suite.
- [x] 1.5 Run `npm run test:web` and confirm the frontend suite remains green.

## 2. Invitation Application and HTTP Contracts

- [x] 2.1 Add failing application tests for client/employee validation, organization-owned projects, admin-role elevation, eight-character collision retries, public resolution, and atomic project grant redemption.
- [x] 2.2 Implement the cryptographic eight-character invitation-code port/adapter and bounded uniqueness retry in the invitation use cases.
- [x] 2.3 Implement typed invitation creation, backend `registrationUrl`, project reach validation, public resolution, and employee-only redemption through membership/access ports.
- [x] 2.4 Add failing HTTP tests for typed create/list inputs, active-only responses, uniform public lookup failures, rate limiting, and `/api/regustration/:code` being open before authentication.
- [x] 2.5 Update Zod schemas, invite routes, composition wiring, serializers, and route ordering for the new contracts.
- [x] 2.6 Run `npm test` and restore a green backend suite.
- [x] 2.7 Run `npm run test:web` and confirm the frontend suite remains green.

## 3. Membership Self-Removal Safety

- [x] 3.1 Add failing member application and API tests proving an admin cannot delete their own membership while another valid member can still be removed.
- [x] 3.2 Reject self-removal against the fresh `ActorContext.membershipId` while retaining the existing last-admin protection.
- [x] 3.3 Add a failing Team UI test proving the acting member has no self-removal control.
- [x] 3.4 Hide the current member's removal action without weakening the API enforcement.
- [x] 3.5 Run `npm test` and restore a green backend suite.
- [x] 3.6 Run `npm run test:web` and restore a green frontend suite.

## 4. Unified Contact Directory

- [x] 4.1 Add failing contact-book tests for the Clients/Employees selector, default client pane, employee pane, and permission-gated invitation controls.
- [x] 4.2 Refactor the contact-book modal into client and employee panes while preserving existing client viewing and editing behavior.
- [x] 4.3 Add failing invitation entity tests for typed creation payloads, type-filtered pending queries, backend registration URLs, cache updates, and revocation disappearance.
- [x] 4.4 Update invitation entity contracts and React Query hooks for typed pending invitations and returned links.
- [x] 4.5 Add failing invitation-form tests for client creation, employee role selection, required project multi-select, admin-role visibility, link copying, and validation errors.
- [x] 4.6 Implement contact-book invitation forms and lists using organization projects and existing permission components.
- [x] 4.7 Add failing Team page tests proving invitation queries and controls are absent, then remove the legacy invitation panel and imports.
- [x] 4.8 Add or update Russian UI strings and route constants for the unified contact directory and `/regustration/:code` link contract.
- [x] 4.9 Run `npm test` and confirm the backend suite remains green.
- [x] 4.10 Run `npm run test:web` and restore a green frontend suite.

## 5. End-to-End Verification

- [x] 5.1 Add an integration test covering create employee invite, list it, resolve its form type publicly, revoke it, and verify it disappears while remaining persisted.
- [x] 5.2 Add an integration test covering client invite creation and resolution without exposing employee-only metadata or allowing employee redemption.
- [x] 5.3 Verify migration deployment from a database containing pending, used, revoked, and expired legacy invitations and document the active-list outcome.
- [x] 5.4 Run `npm test` with PostgreSQL and object storage dependencies and restore a green backend suite.
- [x] 5.5 Run `npm run test:web` and restore a green frontend suite.
- [x] 5.6 Run production builds for the access-policy package, API, web app, and production Docker image.
- [x] 5.7 Run `git diff --check` and `openspec validate consolidate-contact-book-invitations --strict`.
