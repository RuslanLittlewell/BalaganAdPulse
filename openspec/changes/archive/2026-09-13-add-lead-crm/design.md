## Context

See proposal.md for motivation. Current code uses five roles including CLIENT_ADMIN, modular backend boundaries and a shared permission matrix. The task board already provides sortable cards, keyboard dragging, optimistic placement and websocket integration. CRM reach differs from task assignment and project visibility. Production uses PostgreSQL on the VPS; the older OpenSpec context's Render description is not a deployment prerequisite.

## Goals / Non-Goals

**Goals:** Keep lead ownership independent of delivery projects; enforce board isolation in all transports; reuse established UI styling; preserve existing records and task behavior.

**Non-Goals:** Multiple customizable pipelines per client, cross-board lead transfers, automatic customer conversion, forms/webhooks/import integrations, attachments, sales analytics, reminders, email sending, lead assignment or automatic qualification. The user explicitly selected status-only behavior for WON.

## Decisions

### Board identity and persistence

Represent a board as the current organization plus nullable clientId. Null means the agency; a client id means that client's funnel. This gives empty boards without provisioning rows. A separate configurable board model adds lifecycle work without a requested use case.

Add Lead with UUID id, orgId, nullable clientId, name, company, phone, email, website, source, notes, nullable projectId and campaignId, stage, position, createdAt and updatedAt. Attribution is stored on the lead rather than derived: a prospect's origin is a fact about that prospect, and deriving it from the board would lose it the moment a client holds several projects. Both foreign keys are `ON DELETE SET NULL`, so removing a project or campaign releases the field and leaves the lead standing. Text limits follow the spec. Add an index on (orgId, clientId, stage, position). Enforce same-organization client ownership with a composite foreign key to Client(id, orgId), adding the corresponding unique key. Client deletion cascades its leads. Never reuse a task or Client record as a lead: their identity and permissions differ.

### Reach and role rules

Introduce `lead` in the shared permission matrix. ADMIN and MANAGER have CRUD; customer roles have CRUD on their own board; GUEST reads only. All agency staff share the agency funnel. Client board reach for non-admin agency staff requires a whole-client grant; using the existing client-list response alone would expose client-wide lead data to holders of a single-project grant. No task-assignee filter applies. Revalidate membership and grants on every operation and event delivery. Persisted board ownership cannot be edited through lead PATCH.

### REST boundary

- GET `/api/crm/boards`: reachable board descriptors, key `agency` or client UUID, label and role-derived capabilities.
- GET/POST `/api/crm/boards/:boardKey/leads`: list or create within one explicit board.
- GET/PATCH/DELETE `/api/crm/boards/:boardKey/leads/:id`: detail, edit or delete after matching both board and lead.
- PATCH `/api/crm/boards/:boardKey/leads/:id/move`: `{stage, position}`.

Resolve `agency` against the actor's organization. Never trust orgId supplied by callers. Empty valid boards return an empty list. Fail unreachable resources with 404 and forbidden verbs on reachable resources with 403. Reject unknown ownership fields. Field PATCH does not accept stage/position; a dialog stage change uses the move operation and appends to the target stage. Document request/response schemas and errors in OpenAPI.

### Ordering and concurrency

Use one transaction for each create, move and delete, with a transaction-scoped advisory lock keyed by organization and board. Serialize positioning writers, recompute contiguous source/target positions and write audit within that transaction. A single board lock is simple and avoids cross-stage deadlocks; finer-grained locks are unnecessary at initial scale. Responses include affected ordered columns so the optimistic client can reconcile. Rejected optimistic moves refetch authoritative state to avoid overwriting another member's completed move.

### Frontend and synchronization

Add FSD page `crm`, entity `lead`, mutation/dialog features and CRM board widget. Reuse task styling, collision and placement behavior via appropriately located pure shared primitives where useful; do not import task-specific permissions or query caches. Keys include organization and board. Store selection in `/crm?board=...`, clear pending UI state on switches and ignore late responses for the previous board.

Extend the existing websocket transport with separate CRM invalidation messages containing board identity only. Publish after commit, authorize at delivery and refetch only the selected authorized board. Coalesce bursts. Unlike existing task events, CRM need not ship full lead payloads. Refresh on reconnect/window focus, clear forbidden queries on access loss and clear all CRM state on logout. Keep existing task event contracts intact. Audit queries must understand lead reach and exclude agency/client events outside the actor's scope, including deleted leads; retain board scope in audit metadata.

### Form and card defaults

One primary contact per lead uses the explicit fields in the spec. Source is free text so staff can record referrals, website forms, ads or offline sources immediately. Only name is mandatory to allow incomplete incoming leads. Stage descriptions are guidance; progression is manual. Budget, assignee and next-action scheduling can be introduced separately. All cards show available contacts and source; the dialog exposes notes and full truncated values. Russian display strings live in the existing localization dictionary.

## Risks / Trade-offs

- Client-wide CRM reach is broader than project reach → require a whole-client grant and test project-only rejection.
- Eight columns exceed typical desktop widths → preserve horizontal board scrolling, vertical column scrolling and keyboard movement.
- Concurrent writers and late board requests can reorder or leak cards → serialize positioning writes and key all UI/event handling by organization and board.
- Contact data can leak through audit/events → scope audit history and send authorized board invalidations without contact payloads.
- Client deletion removes leads → mention leads in deletion confirmation and retain existing audit history.
- Initial board loads all leads → index board/stage/order and test representative larger boards; pagination is outside this release.

## Migration Plan

1. Add stage enum, lead table, composite client key/foreign key and indexes with an additive Prisma migration. Existing users, clients, projects, tasks and files survive unchanged. All new boards initially contain no leads; do not seed prospects from client records.
2. Test migration against an empty database and a populated pre-change database, then run the required backend and frontend checks and production build.
3. Back up production PostgreSQL, apply the migration through the existing deploy step and deploy API and SPA together.
4. Verify agency/customer separation with separate accounts, lead CRUD, drag persistence, reconnect and existing task flows.
5. Roll back application image if necessary while retaining additive tables and any newly entered leads. Do not drop CRM data as part of application rollback.
