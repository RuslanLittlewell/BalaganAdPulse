## Context

See proposal.md — Why, for motivation. What shapes the approach is the state of the code
after `Refactor to 1.0.0`:

- `Client.ownerId` points at a `User`, and `apps/api/src/auth/scope.ts` reaches every other
  table by walking foreign keys from that column — `ownedClient`, `ownedProject`,
  `ownedCampaign`, `ownedProperty`, `ownedRecord`. It is the only place the chain is spelled
  out, which is what makes replacing it tractable.
- **The hierarchy is already `Client → Project → Campaign → (property, record, value)`.**
  `Campaign.projectId` exists and `Campaign` has no `clientId`. Nothing here inserts a level
  or renames a table.
- `Client` carries the contact book — `fullName`, `organization`, `unp`, `phone`, `telegram`,
  `email`, `website`, `image`, `avatarPath` — and `Project` carries `niche`, `monthlyBudget`,
  `ProjectPriority`, `image`, `avatarPath`. Both stay as they are.
- Avatars for users and clients live in S3 behind `lib/storage.ts` and reach the browser as
  data URLs. Untouched.

Constraints: Express 5 + Prisma + Postgres, layering `routes → controller (Zod) → service
(Prisma)`; an unreachable record answers 404, never 403; migrations run as a pre-deploy step
on Render, so each must be safe against the instance still serving traffic; npm workspaces,
so a shared package is cheap.

## Goals / Non-Goals

**Goals:**

- One organization boundary, with a tenancy seam a second organization could later use
  without rewriting scoping code.
- Row reach and verb permission answered separately, and the verb matrix stated once for both
  API and UI.
- An audit trail trustworthy enough to be the product's answer to "who changed this", which
  means transactional and append-only.
- A data-preserving migration: no wipe, unlike the authentication release.
- Every existing endpoint keeps its path and response shape. What changes is which rows come
  back and which callers are refused.

**Non-Goals:**

- Multi-organization routing — subdomains, an org switcher, billing. The column exists;
  nothing else is built.
- Touching the `Client → Project → Campaign` hierarchy, renaming `Campaign` to `Sheet`, or
  reshaping the `Client` and `Project` field sets. See proposal.md — Deliberately not in this
  change.
- The client portal, comments, tasks and attachments. The `CLIENT` role and its grant exist so
  the portal is additive, but no portal surface is built.

## Decisions

### Roles live on a membership, not on the user

`Membership(userId, orgId, role, status)` rather than `User.role`. A user is an identity; a
role is a position within an organization. This keeps the same account usable when a person is
a manager at the agency and a client on someone else's project later, and it gives suspension
a place to live that is not a flag on the login.

Alternative considered: `User.role` plus a client-assignment table. Fewer joins and less code,
but it welds the account to one organization, and migrating out of it later touches every
table — precisely the migration this change exists to do once.

### Row reach is an explicit grant, verbs come from the role

`ClientAccess(membershipId, clientId, projectId?)` decides the rows; the role decides the
verbs. Admins ignore grants entirely. `projectId` null means every project of the client; set,
it narrows to one — a manager running one project of a large account should not see the rest.

Postgres treats NULLs as distinct in a unique index, so `@@unique([membershipId, clientId,
projectId])` does not prevent two whole-client grants. The migration adds a partial index:

```sql
CREATE UNIQUE INDEX client_access_whole_client_key
  ON client_access (membership_id, client_id)
  WHERE project_id IS NULL;
```

`scope.ts` keeps its present shape and purpose — the one place the chain is spelled out — but
the chain now ends at a grant rather than at a column. The existing names map one to one, so
every call site changes only in what it passes:

```ts
export const clientScope = (actor: Actor) =>
  actor.role === "ADMIN"
    ? { orgId: actor.orgId }
    : { orgId: actor.orgId, access: { some: { membershipId: actor.membershipId } } };

export const projectScope  = (actor: Actor) => ({ client: clientScope(actor) });
export const campaignScope = (actor: Actor) => ({ project: projectScope(actor) });
export const propertyScope = (actor: Actor) => ({ campaign: campaignScope(actor) });
export const recordScope   = (actor: Actor) => ({ campaign: campaignScope(actor) });
```

An unreachable id answers 404, not 403, keeping today's convention: a foreign id and a missing
id look the same from outside, so the response never confirms a record exists.

### The role is loaded per request, not carried in the token

The access token keeps `sub`, `name`, `email`. A `loadActor` middleware resolves the membership
on each request by an indexed lookup and puts an `Actor` on the request.

A role claim in a 15-minute token would leave a demoted or suspended member at their old level
for up to fifteen minutes. Every request already touches Postgres, so one indexed read is
cheaper than that class of bug, and it is what makes "suspension takes effect immediately" true
rather than aspirational.

### One permission matrix, in a workspace package

`packages/access-policy` holds the matrix as plain data plus a pure `can(actor, action,
resource)`. `apps/api` enforces it; `apps/web` renders with it through a `useCan` hook and a
`<Can>` guard. One matrix means the UI cannot drift into offering what the API refuses, and the
matrix is unit-testable without either app.

| Action | Admin | Manager | Guest | Client |
|--------|:-----:|:-------:|:-----:|:------:|
| Organization settings | edit | — | — | — |
| Members: list, change role, suspend, remove | ✓ | — | — | — |
| Clients visible | all | granted | granted | own |
| Client create / edit | ✓ | edit granted | — | — |
| Client delete | ✓ | — | — | — |
| Project create / edit | ✓ | ✓ | — | — |
| Project delete | ✓ | — | — | — |
| Campaigns, columns, formulas | ✓ | ✓ | read | read |
| Cell values | write | write | read | read |
| Audit trail | whole org | granted scope | granted scope | own client |

### The relation field on `Client` is `org`, not `organization`

`Client.organization` already exists as a `String?` — the customer's company name in the
contact book. The relation to the new table is therefore `org Organization @relation(fields:
[orgId] …)`. Renaming the scalar to free the better name would touch the contact-book UI, its
Russian labels and its tests for no behavioural gain, and this change is explicitly not
reshaping `Client`.

### An invitation carries the role, and registration redeems it

A membership has to come from somewhere. The shared `INVITE_CODE` cannot answer "which
role", so it is replaced by an `Invite` row: a code, the role it grants, an optional
expiry, an optional address it is addressed to, and the record of who redeemed it.
`POST /api/auth/register` keeps its request shape — the `inviteCode` field is now looked
up rather than compared — and creates the user, the membership and the redemption in one
transaction, so an account never exists without the membership that makes it usable.

Alternatives considered. *One environment variable per role* (`INVITE_CODE_MANAGER` and
friends) — no schema and no endpoints, but a long-lived secret per role that cannot be
revoked, expired, or traced to who issued it, and rotating one means a redeploy.
*Admin-created accounts, with no self-service* — the admin would have to set and transmit
a password, which is worse than a one-time code.

Every refusal — unknown, expired, revoked, already redeemed, wrong address — answers with
one status and one message. Distinguishing them would turn registration into an oracle for
which codes exist and which addresses were invited.

Single use is the default because the natural unit is one person: a reusable code is a
shared secret again, which is the thing being removed.

**Bootstrapping.** A fresh database has no admin, so nobody can issue the first invitation.
The seed command is what resolves that, which makes it a required setup step rather than a
convenience — the README says so. An existing database needs nothing: the tenancy migration
already made its oldest account an admin.

### The audit event is written by the service, inside the transaction

Services call `writeAudit(tx, event)` within their own `prisma.$transaction`. A log written
after the fact records changes that later rolled back and misses changes that succeeded after
the logger failed; the same transaction is the only way the trail and the data cannot disagree.

Actor context — membership id, name, email, role, ip, user agent, request id — travels in
`AsyncLocalStorage`, populated by one middleware and read by `writeAudit`. Service signatures
stay as they are, and nothing threads an IP address five layers deep.

Alternative considered: a Prisma `$extends` query extension writing events automatically, so a
service cannot forget. Rejected — it cannot see the business context (which project a value
belongs to) without extra queries, and it would write per-row events, which is exactly the
shape the spec forbids for a multi-cell edit. The forgetting risk is covered instead by
requiring an audit assertion in each mutating route's integration test.

The actor is denormalized into the event and `actorId` is `SetNull` on delete, so removing a
member neither erases nor corrupts their trail. `summary` is composed and stored at write time,
so reading history does not depend on entities still existing or still being named the same.

Append-only is enforced twice: no endpoint mutates an event, and the migration revokes `UPDATE`
and `DELETE` on `audit_event` from the application role.

### Data model

Only the new tables and the one changed column are shown. `Project`, `Campaign`,
`CampaignProperty`, `CampaignRecord`, `CampaignPropertyValue`, `User` and `RefreshToken` are
unchanged.

```prisma
enum Role             { ADMIN MANAGER GUEST CLIENT }
enum MembershipStatus { ACTIVE SUSPENDED }
enum AuditAction      { CREATE UPDATE DELETE }

model Organization {
  id              String   @id @default(uuid())
  name            String
  slug            String   @unique
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  members     Membership[]
  clients     Client[]
  auditEvents AuditEvent[]

  @@map("organization")
}

model Membership {
  id        String           @id @default(uuid())
  userId    String           @map("user_id")
  orgId     String           @map("org_id")
  role      Role
  status    MembershipStatus @default(ACTIVE)
  createdAt DateTime         @default(now()) @map("created_at")
  updatedAt DateTime         @updatedAt @map("updated_at")

  user   User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  org    Organization  @relation(fields: [orgId],  references: [id], onDelete: Cascade)
  access ClientAccess[]

  @@unique([userId, orgId])
  @@index([orgId, role])
  @@map("membership")
}

/// The role decides the verbs; this table decides the rows. Admins ignore it.
///   projectId null → every project of the client
///   projectId set  → that project only
model ClientAccess {
  id           String   @id @default(uuid())
  membershipId String   @map("membership_id")
  clientId     String   @map("client_id")
  projectId    String?  @map("project_id")
  createdAt    DateTime @default(now()) @map("created_at")

  membership Membership @relation(fields: [membershipId], references: [id], onDelete: Cascade)
  client     Client     @relation(fields: [clientId],     references: [id], onDelete: Cascade)
  project    Project?   @relation(fields: [projectId],    references: [id], onDelete: Cascade)

  @@unique([membershipId, clientId, projectId])
  @@index([clientId])
  @@map("client_access")
}

/// How a person becomes a member. The role is fixed when the invitation is
/// created, so joining is something an admin authorised rather than something a
/// shared secret allowed.
model Invite {
  id          String      @id @default(uuid())
  orgId       String      @map("org_id")
  code        String      @unique
  role        Role
  /// Optional: binds the invitation to one address.
  email       String?
  expiresAt   DateTime?   @map("expires_at")
  revokedAt   DateTime?   @map("revoked_at")
  usedAt      DateTime?   @map("used_at")
  usedById    String?     @map("used_by_id")
  createdById String?     @map("created_by_id")
  createdAt   DateTime    @default(now()) @map("created_at")

  org       Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  usedBy    User?        @relation(fields: [usedById], references: [id], onDelete: SetNull)
  createdBy Membership?  @relation(fields: [createdById], references: [id], onDelete: SetNull)

  @@index([orgId, createdAt(sort: Desc)])
  @@map("invite")
}

model AuditEvent {
  id         String      @id @default(uuid())
  orgId      String      @map("org_id")
  actorId    String?     @map("actor_id")
  actorName  String      @map("actor_name")
  actorEmail String      @map("actor_email")
  actorRole  Role        @map("actor_role")
  action     AuditAction
  entityType String      @map("entity_type")
  entityId   String      @map("entity_id")
  clientId   String?     @map("client_id")
  projectId  String?     @map("project_id")
  campaignId String?     @map("campaign_id")
  summary    String
  changes    Json?
  requestId  String?     @map("request_id")
  ip         String?
  userAgent  String?     @map("user_agent")
  createdAt  DateTime    @default(now()) @map("created_at")

  org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@index([orgId, createdAt(sort: Desc)])
  @@index([projectId, createdAt(sort: Desc)])
  @@index([clientId, createdAt(sort: Desc)])
  @@index([entityType, entityId, createdAt(sort: Desc)])
  @@map("audit_event")
}
```

`Client` loses `ownerId`/`owner` and its `@@index([ownerId, createdAt])`, and gains:

```prisma
  orgId  String         @map("org_id")
  org    Organization   @relation(fields: [orgId], references: [id], onDelete: Cascade)
  access ClientAccess[]

  @@index([orgId, createdAt])
```

Every other column of `Client` is untouched.

## Risks / Trade-offs

- **A membership lookup on every request** → One indexed read on a connection the request
  already uses. Measure before caching; if it ever matters, cache in-process with a short TTL
  invalidated on role or status change.
- **Dropping `client.owner_id` is irreversible once done** → It survives until the grant-based
  tests are green, so the risky window is one migration wide and the inverse migration can
  rebuild it from the grants until then.
- **Every service that called `ownedClient` and friends changes at once** → The five helpers in
  `scope.ts` are the whole surface, and each maps to exactly one new helper. The existing suite
  covers the behaviour; a green run before and after is the acceptance criterion.
- **A fresh install is unusable until it is seeded** → Registration needs an invitation and
  an invitation needs an admin. The seed command is the documented first step, and it fails
  loudly rather than silently creating a second organization.
- **Audit rows grow without bound** → `(org_id, created_at DESC)` carries the default query.
  Monitor table size; reach for monthly partitioning rather than deletion, since deletion
  defeats the point of the trail.
- **404 for unreachable records hides genuine bugs** → A member who lost a grant sees the same
  404 as for a typo. Accepted: leaking existence is worse, and the audit trail is where a
  support question gets answered.
- **Four capabilities land at once** → They are entangled: roles without scoping are useless,
  and the audit event's context columns need the grant model to know what a member may read.
  Tasks are ordered so each group leaves the suite green.

## Migration Plan

Data is preserved; **no wipe is required**, unlike the authentication release. One Prisma
migration per group, in order:

1. **Organization and membership.** Create `organization` and `membership`. Insert one
   organization. Insert one `ACTIVE` membership per existing `app_user` — the oldest account as
   `ADMIN`, the rest as `MANAGER`. Add `client.org_id`, backfill it to that organization, and
   keep `client.owner_id` for now.
2. **Access grants.** Create `client_access` with its partial unique index, and grant each
   migrated manager the clients they owned, read from `client.owner_id`. This reproduces
   exactly today's visibility. Only once the grant-based tests are green, drop
   `client.owner_id` and its index in a second migration.
3. **Invitations.** Create `invite`. Purely additive: existing accounts already have their
   memberships from step 1, so nothing is backfilled and no existing registration is
   invalidated retroactively.
4. **Audit.** Create `audit_event` and revoke `UPDATE`/`DELETE` on it from the application
   role. Purely additive.

Every step is `ALTER` or `INSERT … SELECT`; no table is dropped and no value is recomputed, so
a failed deploy rolls back cleanly. Because `owner_id` survives until step 2 has been verified,
the risky window is one step wide.

A seed command creates the first organization and its admin from environment variables, for a
fresh database that has no users to migrate.

## Open Questions

- Whether a manager may create clients, or only admins. The matrix says yes; reversing it is a
  one-line change in the matrix package, so it does not block the build.
- Whether `GUEST` should be scoped to projects as often as to clients in practice. The grant
  supports both from day one; only the admin UI's default needs deciding.
