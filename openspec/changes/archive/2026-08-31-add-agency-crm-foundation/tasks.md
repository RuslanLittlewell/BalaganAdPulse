Every task follows the repository's TDD rule: the failing test comes first and is
observed failing before the implementation. Each numbered group ends with a green
`npm test` and `npm run test:web`.

## 1. Shared permission matrix

- [ ] 1.1 Create the `packages/access-policy` workspace (package.json, tsconfig, build) and register it in the root workspaces
- [ ] 1.2 Write failing unit tests for `can(actor, action, resource)` covering every cell of the matrix in design.md
- [ ] 1.3 Implement the matrix as data plus the pure `can()` and export the `Role`, `Action` and `Actor` types
- [ ] 1.4 Wire the package as a dependency of `apps/api` and `apps/web` and confirm both builds resolve it

## 2. Organization and membership

- [ ] 2.1 Add `Organization`, `Membership`, `Role` and `MembershipStatus` to the Prisma schema
- [ ] 2.2 Write the migration that creates the tables, inserts one organization, and inserts one `ACTIVE` membership per existing user — oldest as `ADMIN`, the rest `MANAGER`
- [ ] 2.3 Add `client.org_id`, backfill it to the single organization, and leave `client.owner_id` in place
- [ ] 2.4 Write failing tests for the actor middleware: no membership → 403, suspended membership → 403 on the next request
- [ ] 2.5 Implement `loadActor` middleware that resolves the membership per request and puts an `Actor` on the request
- [ ] 2.6 Write failing tests for `GET /api/auth/me` returning organization, role and reachable clients; implement it
- [ ] 2.7 Write failing tests for the member endpoints, including manager → 403 and last-admin → 409; implement `GET /api/members`, `PATCH /api/members/:id`, `DELETE /api/members/:id`
- [ ] 2.8 Add a seed command that creates the first organization and its admin from environment variables

## 3. Access grants

- [ ] 3.1 Add `ClientAccess` to the Prisma schema
- [ ] 3.2 Write the migration creating `client_access`, granting each migrated manager the clients they owned, and adding the partial unique index for whole-client grants
- [ ] 3.3 Write failing tests for `scopeFor`: admin sees all, manager sees granted only, ungranted id → 404, project-scoped grant narrows the project list
- [ ] 3.4 Replace `apps/api/src/auth/scope.ts` with the grant-based scope resolver and update every service that used `ownedClient` and friends
- [ ] 3.5 Write failing tests asserting a guest is refused every write across clients, projects, sheets and values; enforce it through `assertCan`
- [ ] 3.6 Write failing tests for `PUT /api/members/:id/access`; implement replacing a member's grants
- [ ] 3.7 Drop `client.owner_id` in a migration, once the grant-based tests are green

## 4. Project hierarchy and the sheet rename

- [ ] 4.1 Write the migration renaming `campaign`, `campaign_property`, `campaign_record` and `campaign_property_value` to `sheet`, `sheet_property`, `sheet_record` and `sheet_value`, with their indexes and constraints
- [ ] 4.2 Rename the Prisma models and every reference in `apps/api/src`, as one mechanical commit with no behaviour change, and confirm the suite is green before and after
- [ ] 4.3 Add `Project` and `ProjectStatus` to the schema, and the migration that creates one project per client, adds `sheet.project_id`, backfills it, and drops `sheet.client_id`
- [ ] 4.4 Write failing tests for the project endpoints: create under a client, list ordered by position, planning fields optional, manager must hold an active membership, delete is admin-only
- [ ] 4.5 Implement the project controller, service and routes, and mount `/api/clients/:clientId/projects` and `/api/projects`
- [ ] 4.6 Write failing tests that `/api/campaigns/*` is gone and sheets are created under `/api/projects/:projectId/sheets`; re-parent the sheet routes
- [ ] 4.7 Write a failing test that creating a client seeds one project containing one default-column sheet; update the client service
- [ ] 4.8 Add `ClientStatus` plus the `status` and `currency` columns, with tests for creating a `LEAD` with no projects and for filtering by status
- [ ] 4.9 Add `clientVisible` and `clientEditable` to `SheetProperty` with their defaults, unread for now

## 5. Audit trail

- [ ] 5.1 Add `AuditEvent` and `AuditAction` to the schema, plus the migration that creates the table and revokes `UPDATE` and `DELETE` on it from the application role
- [ ] 5.2 Write failing tests for the request-context middleware carrying actor, ip, user agent and request id through `AsyncLocalStorage`; implement it
- [ ] 5.3 Write failing tests for `writeAudit(tx, event)`: an event is committed with its mutation, a rolled-back mutation leaves none, and a failing audit write rolls the mutation back
- [ ] 5.4 Implement `writeAudit` and the actor snapshot (name, email, role stored at write time)
- [ ] 5.5 Add an audit assertion to the integration test of every mutating route, then call `writeAudit` from each service until they pass
- [ ] 5.6 Write a failing test that editing several cells of one row produces exactly one event listing both fields with before and after values; implement the grouped event
- [ ] 5.7 Write failing tests for the stored summary, including that a later column rename does not change an earlier event; implement summary composition
- [ ] 5.8 Write failing tests for `GET /api/audit`: scoped to the caller, filterable by client, project, sheet, entity, actor and date range, cursor-paginated newest first; implement it

## 6. Frontend — session, roles and permissions

- [ ] 6.1 Extend the auth provider and its tests to carry organization, role and reachable clients from `GET /api/auth/me`
- [ ] 6.2 Add `features/permissions` with `useCan` and a `<Can>` guard over the shared package, with tests
- [ ] 6.3 Add the `entities/organization` and `entities/membership` slices with their queries and tests
- [ ] 6.4 Build the team page: member list, role change, suspend and remove, with controls gated by `<Can>`
- [ ] 6.5 Add tests asserting a guest sees no create, edit or delete control anywhere in the staff app

## 7. Frontend — projects as the primary object

- [ ] 7.1 Rename the `campaign` entity slice to `sheet` and update every import, as one mechanical commit
- [ ] 7.2 Add the `entities/project` slice with queries and tests
- [ ] 7.3 Build the project list page as the staff landing route, grouped and filterable by client
- [ ] 7.4 Build the project page: planning fields, responsible manager, and the sheet tabs beneath
- [ ] 7.5 Add `features/project-management` with the create and edit dialogs
- [ ] 7.6 Update the client sidebar and the client page for the new hierarchy, keeping the sheet behaviour unchanged

## 8. Frontend — activity log

- [ ] 8.1 Add the `entities/audit-event` slice with cursor-paginated queries and tests
- [ ] 8.2 Build `widgets/activity-log-modal` with actor, action, summary, change list and relative time, with tests
- [ ] 8.3 Open the modal project-scoped from the project header, entity-scoped from a sheet row, and organization-wide from the admin area

## 9. Documentation

- [ ] 9.1 Update the README architecture section for organizations, roles, projects and sheets
- [ ] 9.2 Document the seed command and the role model in the README's authentication section
- [ ] 9.3 Run `openspec validate add-agency-crm-foundation --strict` and archive the change
