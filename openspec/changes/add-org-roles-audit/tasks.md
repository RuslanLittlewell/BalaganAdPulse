Every task follows the repository's TDD rule: the failing test comes first and is observed
failing before the implementation it covers.

## 1. Shared permission matrix

- [x] 1.1 Create the `packages/access-policy` workspace (package.json, tsconfig, build) and register it in the root workspaces.
- [x] 1.2 Write the failing unit tests for `can(actor, action, resource)` covering every cell of the matrix in design.md — One permission matrix.
- [x] 1.3 Implement the matrix as data plus the pure `can()`, exporting the `Role`, `Action` and `Actor` types.
- [x] 1.4 Wire the package as a dependency of `apps/api` and `apps/web`, and confirm both builds resolve it.
- [x] 1.5 Run `npm test` and `npm run test:web` — both green.

## 2. Organization, membership and invitations

- [x] 2.1 Add `Organization`, `Membership`, `Role` and `MembershipStatus` to the Prisma schema, naming the `Client` relation field `org` to avoid the existing `Client.organization` scalar.
- [x] 2.2 Write the migration that creates the tables, inserts one organization, and inserts one `ACTIVE` membership per existing user — the oldest account as `ADMIN`, the rest as `MANAGER`.
- [x] 2.3 Add `client.org_id` in the same migration, backfill it to that organization, and leave `client.owner_id` in place.
- [x] 2.4 Write the failing tests for the actor middleware: no membership → 403, suspended membership → 403 on the very next request after suspension.
- [x] 2.5 Implement `loadActor`, resolving the membership per request and putting an `Actor` on the request.
- [x] 2.6 Add `Invite` to the Prisma schema and write the migration creating `invite`.
- [x] 2.7 Write the failing tests for redeeming an invitation at registration: the membership takes the invitation's role, the invitee cannot ask for another, a missing code is 400, and unknown, expired, revoked, already-redeemed and wrong-address codes are all refused with one identical response.
- [x] 2.8 Replace the `INVITE_CODE` comparison in `auth.service.ts` with invitation redemption, creating the user, the membership and the redemption in one transaction, and stop requiring `INVITE_CODE` in `config.ts`.
- [x] 2.9 Write the failing tests for the invitation endpoints — manager → 403, revoking a redeemed invitation → 409, another organization's invitation invisible — then implement `POST /api/invites`, `GET /api/invites` and `DELETE /api/invites/:id`.
- [x] 2.10 Write the failing tests for `GET /api/auth/me` returning organization, role and reachable clients, then implement it.
- [x] 2.11 Write the failing tests for the member endpoints — manager → 403, last admin → 409 — then implement `GET /api/members`, `PATCH /api/members/:id` and `DELETE /api/members/:id`.
- [x] 2.12 Add a seed command that creates the organization's first admin from environment variables, and make it the documented first step for a fresh database.
- [x] 2.13 Run `npm test` and `npm run test:web` — both green.

## 3. Access grants

- [x] 3.1 Add `ClientAccess` to the Prisma schema.
- [x] 3.2 Write the migration creating `client_access` with the partial unique index for whole-client grants, and granting each migrated manager the clients they owned.
- [x] 3.3 Write the failing tests for the scope helpers: admin reaches all, manager reaches granted only, an ungranted id answers 404, and a project-scoped grant narrows the project list.
- [x] 3.4 Replace `apps/api/src/auth/scope.ts` with the grant-based resolvers from design.md and update every service that used `ownedClient`, `ownedProject`, `ownedCampaign`, `ownedProperty` and `ownedRecord`.
- [x] 3.5 Write the failing tests asserting a guest is refused every write across clients, projects, campaigns, properties, records and values, then enforce it through `assertCan`.
- [x] 3.6 Write the failing tests asserting a `CLIENT` member reaches only their own client, then enforce it.
- [x] 3.7 Write the failing tests for `PUT /api/members/:id/access`, then implement replacing a member's grants.
- [x] 3.8 Write the failing test that a client's contact-book fields and picture are unchanged by the ownership move, then drop `client.owner_id` and its index in a migration.
- [x] 3.9 Run `npm test` and `npm run test:web` — both green.

## 4. Audit trail

- [x] 4.1 Add `AuditEvent` and `AuditAction` to the schema, plus the migration creating the table and revoking `UPDATE` and `DELETE` on it from the application role.
- [x] 4.2 Write the failing tests for the request-context middleware carrying actor, ip, user agent and request id through `AsyncLocalStorage`, then implement it.
- [x] 4.3 Write the failing tests for `writeAudit(tx, event)`: an event commits with its mutation, a rolled-back mutation leaves none, and a failing audit write rolls the mutation back.
- [x] 4.4 Implement `writeAudit` and the actor snapshot, storing name, email and role as they were at write time.
- [x] 4.5 Add an audit assertion to the integration test of every mutating route, then call `writeAudit` from each service until they pass.
- [x] 4.6 Write the failing test that editing several cells of one row produces exactly one event listing both fields with before and after values, then implement the grouped event.
- [x] 4.7 Write the failing tests for the stored summary, including that a later column rename does not change an earlier event, then implement summary composition.
- [x] 4.8 Write the failing tests for `GET /api/audit` — scoped to the caller, filterable by client, project, campaign, entity, actor and date range, cursor-paginated newest first — then implement it.
- [x] 4.9 Run `npm test` and `npm run test:web` — both green.

## 5. Frontend — session, roles and permissions

- [x] 5.1 Write the failing tests, then extend the auth provider to carry organization, role and reachable clients from `GET /api/auth/me`.
- [x] 5.2 Write the failing tests, then add `features/permissions` with `useCan` and a `<Can>` guard over the shared package.
- [x] 5.3 Write the failing tests, then add the `entities/organization` and `entities/membership` slices with their queries.
- [x] 5.4 Write the failing tests, then build the team page: member list, role change, suspend and remove, with every control gated by `<Can>`.
- [x] 5.4a Write the failing tests, then add the invitation panel to the team page: create an invitation choosing its role from a list, show the code to copy, list pending invitations and revoke one.
- [x] 5.5 Write the failing tests asserting a guest sees no create, edit or delete control on the projects, clients and campaign screens, then gate those controls.
- [x] 5.6 Add the Russian copy for roles, membership status, the team page and the permission errors to `apps/web/src/shared/config/ru.ts`.
- [x] 5.7 Run `npm test` and `npm run test:web` — both green.

## 6. Frontend — activity log

- [x] 6.1 Write the failing tests, then add the `entities/audit-event` slice with cursor-paginated queries.
- [x] 6.2 Write the failing tests, then build `widgets/activity-log-modal` showing actor, action, summary, change list and relative time.
- [x] 6.3 Open the modal project-scoped from the project header, entity-scoped from a campaign sheet row, and organization-wide from the admin area.
- [x] 6.4 Run `npm test` and `npm run test:web` — both green.

## 7. Documentation and close

- [x] 7.1 Update the README architecture section for organizations, roles and the audit trail, leaving the client, project and campaign hierarchy described as it already is.
- [x] 7.2 Document the seed command and the role model in the README's authentication section, and add the new environment variables to `.env.example` and `apps/api/.env.example`.
- [x] 7.3 Run `openspec validate add-org-roles-audit --strict`, then `npm test` and `npm run test:web` from the repository root — all green.
