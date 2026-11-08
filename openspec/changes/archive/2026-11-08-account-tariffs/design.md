## Context

`Organization.modules` stores a hand-picked `OrgModule[]`. A module gate middleware
reads it per request. Limits do not exist. Clients, projects, memberships, invites and
`ProjectIntegration` rows are created in separate modules.

## Goals / Non-Goals

**Goals**
- One tariff per organization that decides modules and limits.
- Hard limits on create, a trial with read-only expiry, usage visible in the session.

**Non-Goals**
- Payment, invoices, automatic renewal or downgrade.
- White-label, public API access, support tiers.

## Decisions

- **Catalogue in code.** `@adpulse/access-policy` holds a constant table (limits, modules, trial length) keyed by the tariff enum, so the API and the web app read the same figures. Prices and descriptions stay in web copy. Changing a limit is a code change, which suits five fixed plans and avoids a settings table.
- **Prisma.** Add enum `Tariff` and columns `tariff` (default `TRIAL`) and `trial_ends_at` to `organization`. A migration sets every existing row to `ENTERPRISE`, then drops `modules` and the `org_module` enum, which nothing reads any more. The TypeScript `OptionalModule` type in `@adpulse/access-policy` stays.
- **Modules derive.** The module gate and `/api/auth/me` read modules from the catalogue by tariff. This removes the stored list, so tariff and modules cannot disagree.
- **Limit checks go through a `TariffGate` port.** The `tariffs` module implements it, and the kernel hands it to every creating use case: project, client, invitation, Meta and Google connection, and the client registration that creates a client and a project. Each calls `assertCanAdd(orgId, resource)` before writing. The `tariffs` module counts with its own Prisma adapter, as a read model across tables. A failure answers 403 with the standard envelope, an English message and `details: [{ code: "TARIFF_LIMIT", resource, limit }]`, so the web app can show its own Russian text. An expired trial answers `details: [{ code: "TRIAL_ENDED" }]`.
- **Users count** active memberships plus pending invites, excluding the platform administrator. A `CLIENT` or `CLIENT_ADMIN` membership counts as a user.
- **Ad accounts count** `ProjectIntegration` rows of the organization's projects, across providers.
- **Trial expiry** is computed on read: `tariff = TRIAL and trialEndsAt < now`. A middleware after authentication rejects non-`GET`/`HEAD` requests from organization members with 403. Session, logout and password endpoints stay allowed. No scheduler is needed.
- **Downgrades** never delete or lock existing rows. Only creation is checked.
- **Concurrency.** The count runs before the insert, outside its transaction. Two creates sent at the same moment can both pass the last slot and exceed a limit by one. Limits here are commercial, not safety bounds, so this is accepted rather than paying for a row lock on every create.
- **Web.** The platform form swaps module checkboxes for a tariff selector, and the table swaps the modules column for the tariff and trial end. An `entities/tariff` slice holds names, prices, usage text and the translation of a refusal. `features/tariff-status` holds the trial banner, shown in the header to every member, and the tariff dialog, opened from a header button that only an `ADMIN` sees. The client, project, invitation and ad-account forms show a refusal in Russian. All copy goes into `ru.ts`.

## Risks / Trade-offs

- Dropping `modules` is irreversible. The migration runs against production, so take a dump first.
- Read-only by method also blocks harmless POSTs such as report previews. Allow-list them if found.
- Existing Balagan data on `ENTERPRISE` has no limits, so nothing changes for it.

## Migration Plan

1. Add the enum and columns, set existing rows to `ENTERPRISE`.
2. Deploy code that reads tariffs.
3. Drop `modules` in the same migration, after the backfill.

## Open Questions

- Whether `ENTERPRISE` needs per-organization overrides of limits. Out of scope until a customer asks.
