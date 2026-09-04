## Why

AdPulse still authenticates one kind of account. A client is reached because
`client.owner_id` names the user who typed it in, and `apps/api/src/auth/scope.ts` walks
foreign keys from that column to reach everything else. There is no organization, no role,
and no record of who changed what. An agency has admins, managers, guests and customers
working in the same data, and every follow-on — the task board, the client portal,
comments, attachments — needs to know which of them is asking.

This change adds the tenancy, the roles and the audit trail, and nothing else.

## What Changes

- **BREAKING** Client ownership moves from a user to an organization. `Client.ownerId` is
  replaced by `Client.orgId`; who may reach a client is answered by role and an explicit
  access grant rather than by a foreign key. A client belongs to the agency, so reassigning
  an account no longer rewrites rows.
- Four roles arrive as `Membership.role`: `ADMIN`, `MANAGER`, `GUEST`, `CLIENT`. A role is a
  property of a user's place in an organization, not of the account, and it is loaded per
  request so a suspension takes effect immediately.
- Non-admin members get explicit access grants (`ClientAccess`) naming the clients — and
  optionally the single project — they can reach. Admins reach everything in their
  organization.
- Every create, update and delete on a business entity writes an append-only `AuditEvent` in
  the same transaction as the mutation, readable through `GET /api/audit` and surfaced in an
  activity modal.
- The role-to-permission matrix lands once, as data, in a new `packages/access-policy`
  workspace imported by both the API and the web app, so the UI cannot offer what the API
  refuses.
- **BREAKING** The shared `INVITE_CODE` is retired in favour of invitations stored in the
  database. An admin creates an invitation, chooses the role it grants, and passes on its
  code; registering redeems it and creates the account and its membership together. A
  membership has to come from somewhere, and a single secret in the environment cannot say
  who should be an admin and who a guest.

### Deliberately not in this change

This change supersedes the scope of `add-agency-crm-foundation`, which was planned against
the pre-`1.0.0` codebase and is stale. What that change would have built and this one does
not:

- **The `Client → Project → Campaign` hierarchy.** Already delivered by `Refactor to 1.0.0`
  (`20260831020000_restructure_projects`). Left exactly as it is.
- **Renaming `Campaign` to `Sheet`.** A mechanical rename with no behavioural change, worth
  doing on its own one day; entangling it with a tenancy migration only makes both riskier.
- **Reshaping `Client` and `Project`.** The contact-book fields and `ProjectPriority` shipped
  in `1.0.0` and stay untouched. Client lifecycle status, project status, project dates and
  the responsible manager are follow-ons.
- **Seeding a project and sheet when a client is created.** `client.service.ts` deliberately
  stopped doing this in `1.0.0`; that decision stands.

## Capabilities

### New Capabilities

- `organization-membership`: the organization, its members, their roles and status.
- `access-control`: which rows a member reaches and which verbs their role permits.
- `client-management`: clients as organization-owned records rather than user-owned ones.
- `audit-trail`: the append-only record of every mutation, and reading it back.
- `member-invitations`: invitations that name the role they grant, and registration
  redeeming one.

### Modified Capabilities

None. `openspec/specs/` holds no capabilities yet, so there is nothing to write a delta
against and these land whole.

## Impact

- **Schema**: new `organization`, `membership`, `client_access`, `invite`, `audit_event`, and
  the enums `Role`, `MembershipStatus` and `AuditAction`. `client.owner_id` is replaced by
  `client.org_id`. `campaign`, `project`, the property, record and value tables and every
  column on them are untouched. Data is migrated in place; **no wipe is required**.
- **API**: new `/api/org`, `/api/members`, `/api/members/:id/access`, `/api/invites` and
  `/api/audit`. `POST /api/auth/register` keeps its shape but now redeems a stored
  invitation instead of comparing against `INVITE_CODE`.
  `GET /api/auth/me` gains organization, role and reachable clients. Every existing endpoint
  keeps its path and its response shape; what changes is which rows it returns and which
  callers it refuses.
- **Auth**: `apps/api/src/auth/scope.ts` is rewritten — the chain ends at an access grant
  rather than at `ownerId`. The access token keeps its claims; the role is loaded per request.
- **New workspace**: `packages/access-policy`, the permission matrix as data plus a pure
  `can()`, imported by both apps.
- **Frontend**: the auth provider carries organization, role and grants; a `features/permissions`
  slice gates controls; a team page manages members; a `widgets/activity-log-modal` reads the
  trail. The projects, clients and campaign-sheet screens keep their current behaviour and
  gain only permission gating.
- **Environment**: `INVITE_CODE` is no longer read. A fresh installation is bootstrapped by a
  seed command that creates the organization's first admin from environment variables —
  without it there is no admin to issue the first invitation.
- **Deployment**: migrations run as a pre-deploy step on Render, and every step is `ALTER` or
  `INSERT … SELECT`, so a failed deploy rolls back cleanly.
