## Context

The data model already scopes every row by `orgId`, but the application behaves as a
single-organization instance: `Membership` is looked up by user alone, and the seed picks
`organization.findFirst()`. The owner wants one instance with many organizations, each
entitled to a subset of modules, managed from a global admin. Webhooks and automatic
provisioning come later and will call the same creation path.

## Goals / Non-Goals

**Goals:**
- A platform administrator outside any organization, one table of organizations, creation
  of an organization with its first-admin invitation.
- Module entitlements stored per organization and enforced in API and navigation.

**Non-Goals:**
- Webhooks, billing, tariff plans as entities, automatic provisioning, emailing the invite.
- Deleting an organization, and automatic suspension on non-payment (billing will call
  the same suspend operation later).
- A user belonging to several organizations: the resolution by user alone stays.
- Per-organization subdomains or separate databases.

## Decisions

- **Platform administrator is a flag on `User` (`isPlatformAdmin`)**, not a new `Role`.
  Roles belong to memberships; this account has none. Alternative, a `PlatformAdmin`
  table with its own login, was rejected: it duplicates passwords, refresh tokens and the
  login screen for one account. Authentication stays shared; the flag is read from the
  database on each platform request, so revoking it is immediate.
- **Separate mount `/api/platform`, placed before actor resolution.** The existing
  `actor-resolution` rejects accounts with no membership with 403, which is exactly the
  required behavior for every organization endpoint, so nothing changes there. A guard
  `requirePlatformAdmin` protects the new router. Organization members get 403, no
  session 401 (already produced by authentication).
- **Modules as `Organization.modules OrgModule[]` with enum `CRM | TASKS | REPORTS`.**
  Dashboard and Projects are not stored because they cannot vary; the API exposes them
  by always prepending them (`ModuleKey` = `DASHBOARD | PROJECTS | CRM | TASKS | REPORTS`
  in `@adpulse/access-policy` so the web and API share one list). Alternative, a join
  table, was rejected as overkill for three flags. Mirrors the existing
  `Membership.dashboardTiles` array column.
- **Enforcement by a `requireModule(key)` middleware** mounted per route group after
  actor resolution. It reads the organization's modules (one small query, cached per
  request on `req`) and answers `not-found`, matching the project convention that an
  unreachable thing is 404. The actor's `orgId` is already known there. Realtime
  delivery for tasks and leads needs no change: a disabled module produces no events
  because its write endpoints are closed.
- **Creation is one transaction in a `platform` API module**: insert organization (slug
  from name, numeric suffix on collision), then create the `ADMIN` invite with
  `createdById = null` through the invites module's repository port rather than its use
  cases, because those require an actor. The invite is email-bound, so redemption already
  enrols the person into `invite.orgId`. The result carries `registrationUrl`; the UI
  shows it for copying. No email is sent (assumption; a mailer exists for password reset
  and can be reused later).
- **First-admin state in the table** comes from the earliest `ADMIN` invite of the
  organization: unused and unexpired → `PENDING`; used → `ACCEPTED`; none → absent.
- **Status is `Organization.status OrgStatus` (`ACTIVE | SUSPENDED`)**, default
  `ACTIVE`. Resolving the actor already loads the membership; it also reads the
  organization's status and refuses with 403 "Organization is suspended", so the effect is
  immediate for every route behind it and for realtime delivery, which resolves actors per
  event. `GET /api/auth/me` is the one organization-side endpoint that stays answerable:
  for a member of a suspended organization it returns the organization with
  `status: "SUSPENDED"` and no modules, which the web renders as the suspension notice.
  Invitation redemption refuses a suspended organization. A separate suspension table
  with reasons and dates was rejected as premature; only the status is stored.
- **Editing is one `PATCH /api/platform/organizations/:id`** taking optional `name`,
  `modules` and `status`, applied in one transaction; the slug is immutable because
  registration links and future instance addressing rely on it. Removing a module only
  changes the stored set, so data is kept and returns with the module.
- **Seed** is a second function beside `seedFirstAdmin` in `seed-cli.ts`, driven by two
  new environment variables and exposed as `npm run seed:platform`. It is idempotent and
  never overwrites an existing account's password. The password given in conversation is
  placed only in untracked `.env` files, never in the repository, docs or specs.
- **Web:** `/api/auth/me` returns `platformAdmin` and `modules`. `App` renders a
  `PlatformShell` (reusing the app shell with a one-item nav) for the platform admin, and
  the regular shell otherwise. `MainNav` and routes filter by `modules`; a disabled route
  redirects to the dashboard. New feature `organization-admin` and entity `organization`
  follow the existing FSD layout; copy goes into `ru.ts`.

## Risks / Trade-offs

- A dashboard tile or widget may show tasks or leads data of a disabled module →
  implementation checks the summary tiles and agency overview and hides what belongs to a
  disabled module; the API for tiles answers without it.
- The invite link is the only handover channel → shown once in the UI; it can be
  recovered from the table's pending state later (out of scope).
- A user can still belong to one organization only; if the same email is invited into a
  second organization the existing single-membership lookup would misbehave → the
  creation refuses an email that already has a membership (409).
- Suspending the organization the owner works in locks everyone out of it → the platform
  administrator is outside any organization, so they can always reactivate it; the web
  asks for confirmation before suspending.
- Platform-admin session cookies are the same as members' → the guard reads the flag
  fresh each request.

## Migration Plan

One Prisma migration: `app_user.is_platform_admin boolean not null default false`; enum
`org_module`; `organization.modules org_module[] not null default '{CRM,TASKS,REPORTS}'`; enum
`org_status`; `organization.status org_status not null default 'ACTIVE'`. The defaults
apply to existing rows, so Balagan keeps every module, stays active and no data is lost.
New organizations always write their modules explicitly. Deploy: `prisma migrate deploy`
on api start (as today), set the two seed variables on the server, run the seed once.
Rollback: drop the columns and enum; nothing else depends on them.
