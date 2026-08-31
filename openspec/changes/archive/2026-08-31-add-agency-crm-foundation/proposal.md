## Why

AdPulse is a single media buyer's dashboard: every client is owned by the user who
created it, there is exactly one kind of account, and the hierarchy stops at a client's
sheets. A marketing agency needs four kinds of people working in the same data — admin,
manager, guest, and the customer themselves — organised around projects rather than
around whoever typed the client in first, with a record of who changed what.

This change lays the foundation the rest of the CRM stands on: tenancy, roles, the
project level, and the audit trail. The client portal, comments, tasks, attachments and
analytics are follow-on changes that all depend on it, so it comes first.

## What Changes

- **BREAKING** Client ownership moves from a user to an organization. `Client.ownerId`
  is replaced by `Client.orgId`; who may reach a client is answered by role and an
  explicit access grant rather than by a foreign key. A client belongs to the agency, so
  reassigning an account no longer means rewriting rows.
- Four roles arrive as `Membership.role`: `ADMIN`, `MANAGER`, `GUEST`, `CLIENT`. A role
  is a property of a user's place in an organization, not of the account.
- Non-admin members get explicit access grants (`ClientAccess`) naming the clients — and
  optionally the single project — they can reach. Admins reach everything in their
  organization.
- **BREAKING** A `Project` level is inserted between client and sheet, and `Campaign` is
  renamed `Sheet`. One client runs several projects; one project holds several sheets.
  Every `/api/campaigns/...` route becomes `/api/sheets/...`, and sheets are created
  under a project rather than under a client.
- Projects become the primary object: budget, start and end dates, status and a
  responsible manager, and the staff app lands on a project list rather than a client
  list.
- Every create, update and delete on a business entity writes an append-only
  `AuditEvent` in the same transaction as the mutation, readable through `GET /api/audit`
  and surfaced in an activity modal.
- Clients gain a lifecycle (`LEAD`, `ACTIVE`, `PAUSED`, `ARCHIVED`) so a prospect can
  live in the system before it has projects.

Not in this change, and each a follow-on: referral invitations (which retire the shared
`INVITE_CODE`), the client portal, comments and tasks, attachments, client-editable
columns, and the analytics endpoints.

## Capabilities

### New Capabilities

- `organization-membership`: the organization, its members, their roles and status.
- `access-control`: which rows a member reaches and which verbs their role permits.
- `client-management`: clients as organization-owned CRM records with a lifecycle.
- `project-management`: projects under a client, carrying budget, dates and status.
- `metric-sheets`: sheets, columns, day rows and cell values under a project.
- `audit-trail`: the append-only record of every mutation, and reading it back.

### Modified Capabilities

None. `openspec/specs/` is empty — this change establishes the first capability specs,
so the behaviour that exists today is captured as part of the new specs rather than as
deltas against them.

## Impact

- **Schema**: new `organization`, `membership`, `client_access`, `project`,
  `audit_event`. `campaign` → `sheet`, `campaign_property` → `sheet_property`,
  `campaign_record` → `sheet_record`, `campaign_property_value` → `sheet_value`.
  `client.owner_id` dropped in favour of `client.org_id`. Data is migrated in place; no
  wipe is required.
- **API**: `/api/campaigns/*` removed in favour of `/api/sheets/*`; sheets are created
  under `/api/projects/:projectId/sheets`. New `/api/org`, `/api/members`,
  `/api/clients/:id/projects`, `/api/projects/*`, `/api/audit`. `GET /api/auth/me` gains
  role and reachable clients.
- **Auth**: `apps/api/src/auth/scope.ts` is replaced — the ownership chain now ends at an
  access grant. The access token keeps its claims; the role is loaded per request rather
  than carried in the token, so a suspension takes effect immediately.
- **New workspace**: `packages/access-policy`, the role/permission matrix as data plus a
  pure `can()`, imported by both the API and the web app so the two cannot drift.
- **Frontend**: entities and routes re-parented around projects; `features/permissions`
  and a `widgets/activity-log-modal` added. `CampaignTabs` becomes the sheet tabs inside
  a project, unchanged in behaviour.
- **Deployment**: migrations already run as a pre-deploy step on Render, and every step
  here is `ALTER`/`INSERT … SELECT`, so a failed deploy rolls back cleanly.
