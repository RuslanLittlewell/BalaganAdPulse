## Context

Today `Client.ownerId` points at a `User`, and `apps/api/src/auth/scope.ts` reaches every
other table by walking foreign keys from that column. There is one account type, no
organization, and the hierarchy is `Client → Campaign → (properties, records, values)`,
where a "campaign" is really a tab of daily metrics — `CampaignSheet.tsx` and
`DEFAULT_CAMPAIGN_NAME = "Main"` both already treat it as a sheet.

Constraints that shape the approach: Express 5 + Prisma + Postgres with the layering
`routes → controller (Zod) → service (Prisma)`; money crosses the API as decimal strings;
migrations run as a pre-deploy step on Render, so a migration must be safe against the
instance still serving traffic; the repository is npm workspaces, so a shared package is
cheap.

See `proposal.md` — Why, for motivation.

## Goals / Non-Goals

**Goals:**

- One organization boundary with a tenancy seam that a second organization could later
  use without rewriting scoping code.
- Row reach and verb permission answered separately, and the verb matrix stated once for
  both API and UI.
- Projects as the primary object, with sheets keeping their current behaviour underneath.
- An audit trail trustworthy enough to be the product's answer to "who changed this",
  which means transactional and append-only.
- A data-preserving migration: no wipe, unlike the auth release.

**Non-Goals:**

- Multi-organization routing — subdomains, an org switcher, billing. The column exists;
  nothing else is built.
- The client portal UI, invitations, comments, tasks, attachments, client-editable
  columns and the analytics endpoints. Each is a follow-on change that depends on this
  one; the schema below anticipates them but this change does not build them.
- Replacing the shared `INVITE_CODE`. It survives one more change, then the invitations
  change retires it.

## Decisions

### Roles live on a membership, not on the user

`Membership(userId, orgId, role, status)` rather than `User.role`. A user is an identity;
a role is a position within an organization. This keeps the same account usable when a
person is a manager at the agency and a client on someone else's project later, and it
gives suspension a place to live that is not a flag on the login.

Alternative considered: `User.role` with a client-assignment table. Fewer joins and less
code, but it welds the account to one organization, and the migration out of it later
touches every table — precisely the migration this change exists to avoid repeating.

### Row reach is an explicit grant, verbs come from the role

`ClientAccess(membershipId, clientId, projectId?)` decides the rows; the role decides the
verbs. Admins ignore grants entirely. `projectId` null means every project of the client;
set, it narrows to one — a manager running one project of a large account should not see
the rest.

Postgres treats NULLs as distinct in a unique index, so `@@unique([membershipId,
clientId, projectId])` does not prevent two whole-client grants. The migration adds a
partial index:

```sql
CREATE UNIQUE INDEX client_access_whole_client_key
  ON client_access (membership_id, client_id)
  WHERE project_id IS NULL;
```

`scope.ts` keeps its present shape and role — the one place the ownership chain is
spelled out — but the chain now ends at a grant rather than at a column:

```ts
export const clientScope = (actor: Actor) =>
  actor.role === "ADMIN"
    ? { orgId: actor.orgId }
    : { orgId: actor.orgId, access: { some: { membershipId: actor.membershipId } } };

export const projectScope = (actor: Actor) => ({ client: clientScope(actor) });
export const sheetScope   = (actor: Actor) => ({ project: projectScope(actor) });
```

An unreachable id answers 404, not 403, keeping today's convention: a foreign id and a
missing id look the same from outside, so the response never confirms a record exists.

### The role is loaded per request, not carried in the token

The access token keeps `sub`, `name`, `email`. A middleware loads the membership on each
request by an indexed lookup and puts an `Actor` on the request.

A role claim in a 15-minute token would leave a demoted or suspended member at their old
level for up to fifteen minutes. Every request already touches Postgres, so one indexed
read is cheaper than that class of bug, and it is what makes "suspension takes effect
immediately" true rather than aspirational.

### One permission matrix, in a workspace package

`packages/access-policy` holds the matrix as plain data plus a pure
`can(actor, action, resource)`. `apps/api` enforces it; `apps/web` renders with it
through a `useCan` hook and a `<Can>` guard. One matrix means the UI cannot drift into
offering what the API refuses, and the matrix is unit-testable without either app.

| Action | Admin | Manager | Guest | Client |
|--------|:-----:|:-------:|:-----:|:------:|
| Organization settings | edit | — | — | — |
| Members: list, invite, change role | ✓ | — | — | — |
| Clients visible | all | granted | granted | own |
| Client create / edit | ✓ | edit granted | — | — |
| Client delete | ✓ | — | — | — |
| Project create / edit | ✓ | ✓ | — | — |
| Project delete | ✓ | — | — | — |
| Sheets, columns, formulas | ✓ | ✓ | read | read |
| Cell values | write | write | read | read |
| Audit trail | whole org | granted scope | granted scope | own client |

The client column describes what this change delivers; the portal change widens it to
comments, requests, files and the columns marked client-editable.

### Project is inserted; Campaign is renamed Sheet

`Client → Project → Sheet → (SheetProperty, SheetRecord, SheetValue)`. "Campaign" already
means the project-level thing to a media buyer, so keeping it for a tab would leave the
codebase using one word for two levels. The rename is mechanical and the sheet behaviour
is unchanged.

Alternative considered: keep two levels and let a client's campaigns serve as projects.
Rejected because a client with several projects, each with several traffic sources, is
the normal case, and the flat model has nowhere to put a budget, a status or a
responsible manager.

### Data model

```prisma
enum Role             { ADMIN MANAGER GUEST CLIENT }
enum MembershipStatus { ACTIVE SUSPENDED }
enum ClientStatus     { LEAD ACTIVE PAUSED ARCHIVED }
enum ProjectStatus    { DRAFT ACTIVE PAUSED COMPLETED ARCHIVED }
enum AuditAction      { CREATE UPDATE DELETE }

model Organization {
  id              String   @id @default(uuid())
  name            String
  slug            String   @unique
  defaultCurrency String   @default("USD") @map("default_currency")
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

  user            User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization    Organization   @relation(fields: [orgId], references: [id], onDelete: Cascade)
  access          ClientAccess[]
  managedProjects Project[]      @relation("ProjectManager")

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
  client     Client     @relation(fields: [clientId], references: [id], onDelete: Cascade)
  project    Project?   @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([membershipId, clientId, projectId])
  @@index([clientId])
  @@map("client_access")
}

model Client {
  id            String       @id @default(uuid())
  orgId         String       @map("org_id")
  name          String
  niche         String?
  monthlyBudget Decimal?     @map("monthly_budget") @db.Decimal(12, 2)
  email         String?
  currency      String?
  status        ClientStatus @default(ACTIVE)
  createdAt     DateTime     @default(now()) @map("created_at")
  updatedAt     DateTime     @updatedAt @map("updated_at")

  organization Organization   @relation(fields: [orgId], references: [id], onDelete: Cascade)
  projects     Project[]
  access       ClientAccess[]

  @@index([orgId, status, createdAt])
  @@map("client")
}

model Project {
  id        String        @id @default(uuid())
  clientId  String        @map("client_id")
  name      String
  status    ProjectStatus @default(ACTIVE)
  startDate DateTime?     @map("start_date") @db.Date
  endDate   DateTime?     @map("end_date")   @db.Date
  budget    Decimal?      @db.Decimal(12, 2)
  managerId String?       @map("manager_id")
  position  Int
  createdAt DateTime      @default(now()) @map("created_at")
  updatedAt DateTime      @updatedAt @map("updated_at")

  client  Client         @relation(fields: [clientId], references: [id], onDelete: Cascade)
  manager Membership?    @relation("ProjectManager", fields: [managerId], references: [id], onDelete: SetNull)
  sheets  Sheet[]
  access  ClientAccess[]

  @@index([clientId, position])
  @@map("project")
}

model Sheet {
  id        String   @id @default(uuid())
  projectId String   @map("project_id")
  name      String
  position  Int
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  project    Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)
  properties SheetProperty[]
  records    SheetRecord[]

  @@index([projectId, position])
  @@map("sheet")
}
```

`SheetProperty`, `SheetRecord` and `SheetValue` are today's `CampaignProperty`,
`CampaignRecord` and `CampaignPropertyValue` with the foreign key renamed to `sheetId`;
`PropertyType`, the formula JSON and the rule that computed properties store no values
are unchanged. `SheetProperty` also gains `clientVisible` (default true) and
`clientEditable` (default false) — the columns are added here so the portal change is
additive, and nothing in this change reads them.

```prisma
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
  sheetId    String?     @map("sheet_id")
  summary    String
  changes    Json?
  requestId  String?     @map("request_id")
  ip         String?
  userAgent  String?     @map("user_agent")
  createdAt  DateTime    @default(now()) @map("created_at")

  @@index([orgId, createdAt(sort: Desc)])
  @@index([projectId, createdAt(sort: Desc)])
  @@index([clientId, createdAt(sort: Desc)])
  @@index([entityType, entityId, createdAt(sort: Desc)])
  @@map("audit_event")
}
```

### The audit event is written by the service, inside the transaction

Services call `writeAudit(tx, event)` within their own `prisma.$transaction`. A log
written after the fact records changes that later rolled back and misses changes that
succeeded after the logger failed; the same transaction is the only way the trail and the
data cannot disagree.

Actor context — membership id, name, email, role, ip, user agent, request id — travels in
`AsyncLocalStorage`, populated by one middleware and read by `writeAudit`. Service
signatures stay as they are, and nothing threads an IP address five layers deep.

Alternative considered: a Prisma `$extends` query extension writing events automatically,
so a service cannot forget. Rejected for now — it cannot see the business context (which
project a value belongs to) without extra queries, it cannot group a multi-cell edit into
one event, and it would write per-row events, which is exactly the shape the spec
forbids. The forgetting risk is covered by requiring an audit assertion in each mutating
route's integration test.

The actor is denormalized into the event and `actorId` is `SetNull` on delete, so removing
a member neither erases nor corrupts their trail. `summary` is computed and stored at
write time, so reading history does not depend on entities still existing or still being
named the same.

Append-only is enforced twice: no endpoint mutates an event, and the migration revokes
`UPDATE` and `DELETE` on `audit_event` from the application role.

### The portal will reuse this API, not get its own

The client portal is a different shell over the same endpoints; the scope resolver
narrows what comes back. Building a `/api/portal/*` surface would mean a second
permission implementation to keep in sync with the first, which is how portals leak.

## Risks / Trade-offs

- **A membership lookup on every request** → It is one indexed read on a connection the
  request already uses. Measure before caching; if it ever matters, cache in-process with
  a short TTL and invalidate on role or status change.
- **The rename touches most of the codebase at once** → Do it as its own commit,
  mechanical and test-covered, with no behaviour change in the same commit. The existing
  suite is the safety net; a green run before and after is the acceptance criterion.
- **Audit rows grow without bound** → `(org_id, created_at DESC)` carries the default
  query. Monitor table size; reach for monthly partitioning rather than deletion, since
  deletion defeats the point of the trail.
- **404 for unreachable records hides genuine bugs** → A member who lost a grant sees the
  same 404 as for a typo. Accepted: leaking existence is worse. The audit trail is where
  a support question gets answered.
- **`skip_specs` is not set and six capabilities land at once** → The change is large
  because the schema changes are entangled: roles without scoping are useless, and the
  project level cannot be inserted after the audit trail without rewriting its context
  columns. Tasks are ordered so each group leaves the suite green.

## Migration Plan

Data is preserved; no wipe, unlike the authentication release. One Prisma migration per
group, in order:

1. **Organization and membership.** Create `organization` and `membership`; insert one
   organization; insert one `ACTIVE` membership per existing `app_user`, the oldest
   account as `ADMIN` and the rest as `MANAGER`. Add `client.org_id`, backfill it, keep
   `client.owner_id` for now.
2. **Access grants.** Create `client_access` and grant each migrated manager the clients
   they owned, read from `client.owner_id`. This reproduces exactly today's visibility.
   Only then drop `client.owner_id`.
3. **Project and rename.** Rename `campaign` → `sheet` and its three children, with their
   indexes and constraints. Create `project`. For each client insert one project named
   after the client, add `sheet.project_id`, backfill it from the sheet's old
   `client_id`, then drop `sheet.client_id`.
4. **Audit.** Create `audit_event` and revoke `UPDATE`/`DELETE` on it from the
   application role. Additive.

Every step is `ALTER` or `INSERT … SELECT`; no table is dropped and no value is
recomputed, so a failed deploy rolls back cleanly. Rollback for steps 1–3 is the inverse
migration; because `owner_id` survives until step 2 has been verified, the risky window
is one step wide.

## Open Questions

- Whether a manager may create clients, or only admins. The matrix above says yes;
  reversing it is a one-line matrix change, so it does not block the build.
- Whether `GUEST` should be scoped to projects as often as to clients in practice. The
  grant supports both from day one; only the admin UI's default needs deciding.
