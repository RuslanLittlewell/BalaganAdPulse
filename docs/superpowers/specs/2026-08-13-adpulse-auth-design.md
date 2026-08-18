# AdPulse — Design (Phase 9: authentication and data isolation)

**Date:** 2026-08-13
**Status:** approved

> Shared context and conventions: [conventions.md](../conventions.md).

## Context

Eight phases built a working dashboard: clients, campaign sheets, computed metrics,
cell editing and row management. All of it belongs to nobody. There is no user, no
sign-in, and no query in any service is restricted to an owner — whoever reaches the
API sees every client in the database.

That is the last thing standing between the project and a public deployment, and it is
the reason this phase comes before the production work. The remaining deployment tasks
(serving the built SPA from Express, `prisma migrate deploy` on start, a health
endpoint, `trust proxy`, a compiled production build) are independent of it and follow
in their own phase.

The change reaches further than a login form. `Client` gains an owner, and every entry
point in every service — 18 of them across five service modules — has to filter by that
owner.

## Scope

**In scope:** registration behind an invite code, sign-in, sign-out, access and refresh
tokens with silent renewal, route guarding, the signed-in user's name and a log-out
control in the sidebar footer, and owner filtering across the whole service layer. A
shared `Loader` replaces the ad-hoc skeletons currently used for loading states.

**Out of scope:** password change, password recovery by email, account deletion, roles
and permissions, sharing a client between users, OAuth providers, and rate limiting on
the sign-in endpoint. None of their controls are rendered — not rendered disabled.

The work splits into two plans against this one spec. Plan 1 delivers the backend: the
two models, the four endpoints, the guard, and owner filtering across the service layer
— at which point the API is closed and the existing frontend can no longer reach it.
Plan 2 delivers the browser half: the two pages, route guarding, silent token renewal,
the sidebar footer and the shared `Loader`. The split follows the dependency rather than
convenience; the frontend has nothing to sign in against until plan 1 lands.

## Data model

```prisma
model User {
  id           String         @id @default(uuid())
  email        String         @unique
  name         String
  passwordHash String         @map("password_hash")
  createdAt    DateTime       @default(now()) @map("created_at")
  clients      Client[]
  refreshTokens RefreshToken[]

  @@map("app_user")
}

model RefreshToken {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String   @unique @map("token_hash")
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  @@index([userId])
  @@map("refresh_token")
}
```

The table is `app_user`, not `user`: `USER` is a reserved word in PostgreSQL, and while
Prisma quotes its identifiers, every hand-written query against the database would have
to remember to quote it too.

`Client` gains an owner:

```prisma
ownerId String @map("owner_id")
owner   User   @relation(fields: [ownerId], references: [id], onDelete: Cascade)

@@index([ownerId, createdAt])
```

The index serves `listClients`, which orders by `createdAt` descending and now filters
by owner as well. Deleting a user cascades to their clients and from there, through the
existing cascades, to campaigns, properties, records and values.

The migration is plain DDL and assumes an empty `client` table: the development
database is reset with `prisma migrate reset` before it is applied, and no production
database exists yet. It carries no data-backfill step.

Email is normalized in the Zod schema — trimmed and lowercased — before it reaches the
database. Without that, `Buyer@acme.com` and `buyer@acme.com` both satisfy the unique
constraint and become two accounts for one address.

## Passwords

`auth/password.ts` exports two pure functions, `hashPassword` and `verifyPassword`,
built on `scrypt` from `node:crypto`: 16 random bytes of salt, `N=16384, r=8, p=1`, a
64-byte key, stored as `salt:hash` in hex, compared with `timingSafeEqual`.

`scrypt` ships with Node, so the API's four runtime dependencies stay four. The
alternatives were weighed and rejected: `bcryptjs` is pure JavaScript and therefore
slow at the work factors that matter, and `argon2` pulls a native build into the Docker
image.

The salt is stored alongside the hash by design. It is not a secret — its job is to
make identical passwords hash differently, so that one precomputed table cannot attack
every account at once. Verification needs it, so it must be stored.

Zod requires at least 8 characters and imposes no character-class rules.

## Tokens

Two tokens of different natures.

**Access** — a JWT signed HS256 with `JWT_SECRET`, valid 15 minutes, carrying `sub`,
`name` and `email` alongside the standard `iat` and `exp`. Signing and verification use
`jose`: ESM, typed and dependency-free. The browser reads the name for the sidebar and
`exp` for the freshness check straight out of the payload, so no `/me` round trip is
needed to know who is signed in.

**Refresh** — not a JWT but 32 random bytes in hex, valid 30 days. There is nothing to
sign: the server looks it up in the database on every use, and a signature would not
add a check. It is stored as its `sha256` digest, so a leaked database dump is not a
set of working keys. A plain digest suffices here, unlike for passwords: the value
already carries 256 bits of entropy, and a key-derivation function exists to slow down
guessing of low-entropy secrets.

Refresh tokens are **not rotated**. A refresh returns a new access token and leaves the
refresh token in place. Rotation would shorten the life of a stolen refresh token to
the next legitimate renewal, but it also makes any second use of a token a failure —
which is exactly what two open browser tabs produce, evicting the user for no reason.
With tokens in `localStorage`, where a successful XSS reads everything at once anyway,
rotation buys less than it costs. Revocation is preserved by other means: signing out
deletes the row.

Expired rows for a user are deleted on each successful sign-in, which keeps the table
from growing without a scheduled job.

Both tokens live in `localStorage`. This is a deliberate trade-off, recorded here so it
is not rediscovered as a surprise: any script running on the page can read them, and a
signed access token cannot be revoked before it expires. The 15-minute access lifetime
is what bounds that window, and the refresh row in the database is what makes sign-out
real.

## Authentication endpoints

All four live in `apps/api/src/auth/` and are mounted before the guard, so they are
reachable without a token.

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/auth/register` | `{ name, email, password, inviteCode }` | 201 `{ accessToken, refreshToken }` |
| POST | `/api/auth/login` | `{ email, password }` | 200 `{ accessToken, refreshToken }` |
| POST | `/api/auth/refresh` | `{ refreshToken }` | 200 `{ accessToken }` |
| POST | `/api/auth/logout` | `{ refreshToken }` | 204 |

Registration requires `inviteCode` to equal `INVITE_CODE`. The application is a
single-operator tool for now, and an open sign-up form on a public deployment collects
strangers and bots. Opening registration later means deleting one check, not designing
a new flow.

There is no way to invalidate an access token before it expires, so signing out means
deleting the refresh row and discarding both tokens in the browser. `logout` on a token
that is already gone answers 204 as well: the caller's goal — that this token no longer
works — is satisfied either way.

`requireAuth` reads `Authorization: Bearer <token>`, verifies it with `jose` and sets
`req.user = { id }`, typed through declaration merging in `types/express.d.ts`.

Mounting order in `createApp` matters:

```
/api/auth  → authRouter    (open)
/api       → requireAuth   (everything below is closed)
/api/clients, /api/campaigns, /api/properties, /api/records
```

A route added a year from now lands behind the guard by default, rather than being open
until somebody remembers to protect it.

## Token renewal in the browser

Renewal has two triggers, and both are needed.

**Ahead of the request.** Before sending, the wrapper checks `exp` with a 30-second
margin; if the token is expired or about to be, it renews first. This is the normal
path — one renewal every fifteen minutes, and every other request goes straight out.
The margin exists because a token that is valid at the moment of the check can still
expire in flight.

**After a 401.** If the server rejects the token anyway, the wrapper renews and repeats
the request exactly once. The check ahead of the request trusts the browser's clock; a
clock off by a few minutes makes an expired token look fresh, and without a second line
of defence the application simply stops working.

Repeating is safe even for `POST` and `DELETE`. A 401 comes from the guard, before the
request reaches any service, so nothing happened that a repeat would happen twice. The
body is always a `JSON.stringify` string rather than a stream, so it can be sent again
without cloning.

**One renewal at a time.** Renewal is held in a single module-level promise: the first
caller creates it, every other caller awaits the same one. A page load with an expired
access token fires several requests at once, and without this each of them would open
its own renewal.

**No loops.** The call to `/api/auth/refresh` bypasses the wrapper and uses a bare
`fetch`; otherwise its own 401 would trigger a renewal, which would trigger a renewal.
The repeat is counted per request: once, after which a 401 is returned to the caller as
an ordinary error.

**No background timer.** Renewing on a schedule sounds tidy, but a forgotten open tab
would then extend a session indefinitely without anyone touching the application.
Renewal happens only when there is a request to send.

**End of session.** A failed renewal is the single point where the session is declared
dead. `session.ts` clears both tokens and emits `sessionExpired`; `AuthProvider` catches
it, calls `queryClient.clear()` and navigates to `/login`. Clearing the cache is not
cosmetic — without it, the next person to sign in on the same laptop sees the previous
user's clients in the sidebar until React Query refetches.

Navigation goes through `navigate` rather than `window.location`, which is why the
listener lives in a component rather than in the module.

```
lib/auth/tokenStore.ts   read and write the pair in localStorage
lib/auth/jwt.ts          decodePayload, isExpired(skew) — pure and synchronous
lib/auth/session.ts      ensureFreshToken(), single-flight, sessionExpired
lib/http.ts              check ahead of the request, one repeat after a 401
features/auth/AuthProvider.tsx   current user, sign-in, sign-out, session expiry
```

The pure, synchronous halves are separated deliberately: all of the asynchronous
subtlety is in `session.ts`, and it is the only file here that has to be read carefully.

## Data isolation

The filter is needed only on the query that first fetches an entity by an id from
outside. Once the top entity is confirmed to belong to the caller, everything reachable
from it through foreign keys belongs to the caller by construction. So this is one
nested `where` per entry point, not per query.

`src/auth/scope.ts` holds the four fragments, one per level of the chain:

```ts
ownedClient   = (ownerId, id) => ({ id, ownerId })
ownedCampaign = (ownerId, id) => ({ id, client: { ownerId } })
ownedProperty = (ownerId, id) => ({ id, campaign: { client: { ownerId } } })
ownedRecord   = (ownerId, id) => ({ id, campaign: { client: { ownerId } } })
```

The chain `client: { ownerId }` is written nowhere else. Another level of nesting later
changes this file and only this file.

Every service entry point takes `ownerId` as its first parameter, and every controller
passes `req.user.id`. Omitting it is a compile error rather than a silent hole, which
is why this was chosen over a separate guard layer that controllers must remember to
call, and over a Prisma client extension that would hide the filter from the call site
while still needing a per-model definition — `Campaign`, `CampaignProperty` and
`CampaignRecord` have no `ownerId` of their own.

| Module | Entry points that gain the filter | Internals left alone |
|--------|-----------------------------------|----------------------|
| `client.service` | all five | — |
| `campaign.service` | `assertClientExists` → `assertClientOwned`, `getCampaign`, `getCampaignTable` | `normalizePositions` |
| `property.service` | `createProperty`'s campaign lookup, `getProperty` | `siblings`, `reorder`, `countValues` |
| `record.service` | `createRecord`'s campaign lookup, `getRecord` | `assertDateIsFree` |
| `value.service` | the record lookup in `setPropertyValue` | the property check |

`value.service` needs the filter only on the record. The property below it is already
constrained by `property.campaignId !== record.campaignId`: if the record belongs to
the caller then so does its campaign, and so does a property of that campaign. A second
filter would be a query to prove something already proven.

Nine `findUnique` calls become `findFirst`, because `where` on `findUnique` accepts only
a unique key and a condition across a relation is not one. The `findUnique` inside
`assertDateIsFree` stays: it goes by the composite key and sits below the check.

**A foreign id answers 404, not 403.** A filtered query returns `null` for a
non-existent id and for someone else's id alike, and `null` already becomes
`NotFoundError`. This is a property of the design rather than a branch in the code, and
it means an outsider cannot probe ids to learn which campaigns exist.

## Frontend

The component library already covers the forms: `TextField` extends
`InputHTMLAttributes`, so `type="password"` works untouched, and `isEmail` in
`lib/validation.ts` mirrors the server's rule. What is new is a page without a sidebar.

`AppShell` currently wraps every route, so the route tree splits in two:

```
/login, /signup       → CenteredPanel, no shell
/, /clients/*         → RequireAuth → AppShell → the existing routes
```

`CenteredPanel` joins the shared library as a one-slot card centred on screen, knowing
nothing about authentication.

**Start-up costs no request.** `RequireAuth` admits the visitor when a refresh token is
present in `localStorage` and redirects to `/login` when it is not. The sidebar's name
comes from the access token's payload, and a payload is readable even when expired —
expiry decides whether the server accepts the token, not whether it can be parsed. So
the name is on screen immediately and a stale access token is renewed silently by the
first request for data. If the refresh token turns out to be invalid, the session-expiry
path above takes over.

`AuthProvider` holds the current user, exposes `useAuth() → { user, login, register,
logout }` and listens for `sessionExpired`. Signing out calls `POST /api/auth/logout` so
the row really disappears, then does what an expired session does. A network failure on
that call must not prevent signing out — the local half runs regardless.

`LoginPage` takes an email and a password; `SignupPage` takes a name, an email, a
password and an invite code. Browser-side validation is deliberately thin — non-empty
fields, `isEmail`, at least 8 characters — and everything else is the server's verdict,
displayed above the form as it arrives. API messages are English and fit to show
unchanged, the same way cell errors already do. The pages link to each other; there is
no separate navigation.

`RequireAuth` records the current path in `location.state`, and signing in returns the
visitor to the campaign they were looking at rather than to an empty root.

**The sidebar footer.** `UserMenu` in `features/auth/components/UserMenu` renders the
name as plain text with `Log out` below it in the accent colour. `ClientSidebar` passes
it to `Sidebar`'s existing `footer` prop, which already draws the dividing rule; the
`Sidebar` component itself does not change.

## Loading states

`components/Loader` joins the shared library: an accent-coloured arc on a muted ring
with a label beside it, `label` defaulting to `Loading…` from `en.ts` and `size`
offering two sizes. It carries `role="status"` and `aria-live="polite"` so the state is
announced, and it stops animating under `prefers-reduced-motion`, which spares people
with vestibular sensitivity an endless spin.

It becomes the single way the application says it is busy: the sign-in and sign-up forms
while a request is in flight, the rare start-up pause when a refresh token exists but the
access token cannot be read, and the client list in the sidebar — whose grey skeletons it
replaces.

## Errors

`errors.ts` gains `UnauthorizedError` (401) and `ForbiddenError` (403).

| Situation | Status | Message |
|-----------|--------|---------|
| Unknown email, or wrong password | 401 | `Invalid email or password` |
| Missing, malformed or expired token | 401 | `Authentication required` |
| Unknown or expired refresh token | 401 | `Session expired` |
| Wrong invite code | 403 | `Invalid invite code` |
| Email already registered | 409 | `This email is already registered` |

A wrong email and a wrong password give the identical answer, so the sign-in form cannot
be used to enumerate which addresses have accounts.

## Configuration

`JWT_SECRET` and `INVITE_CODE` are read at start-up, and the process exits with a clear
message if either is empty. A server that comes up quietly with an empty secret signs
tokens that anyone can forge.

## Testing

TDD throughout, tests before implementation.

`resetDb` clears `refreshToken` and `user` alongside the existing tables.
`test/helpers/auth.ts` returns `{ user, auth }`, where `auth` is a ready
`Authorization` header signed with the same helper production uses rather than obtained
through `/login`. That is a necessity, not a shortcut: `scrypt` is deliberately slow, and
hashing a password in every `beforeEach` would add seconds of waiting to the suite.

Existing API tests gain `.set(auth)` on each request, across six files; existing service
tests gain `ownerId` as a first argument. On the frontend, the shared render helper in
`src/test/utils.tsx` defaults to a signed-in user, so the already-written page tests do
not each have to get past `RequireAuth`.

| Unit | Covered by its test |
|------|---------------------|
| `password.ts` | The same password hashes differently twice; verification accepts and rejects |
| `auth` API | Registration with and without a valid code; sign-in with a wrong password; refresh with an unknown token; sign-out deletes the row |
| `requireAuth` | No header, malformed token and expired token each give 401 |
| Isolation | A request without a token gives 401; a foreign id gives 404 for a client, a campaign, a property, a record and a value |
| `jwt.ts` | Payload parsing, `isExpired` with its margin, a malformed token does not throw |
| `session.ts` | Three parallel calls produce one request to `/refresh`; a failure clears the tokens and emits the event |
| `http.ts` | An expired access token is renewed before the request; a 401 causes exactly one repeat |
| `RequireAuth` | Without a token, a redirect to `/login` that preserves the path |
| `LoginPage` | Validation, a server error above the form, success returning to the saved path |
| `UserMenu` | The name is shown; signing out clears storage and navigates to sign-in |
| `Loader` | The label renders and the element carries `role="status"` |

Five isolation checks rather than eighteen: the filter is built from shared fragments,
and covering every endpoint separately would be testing one function five times over.
