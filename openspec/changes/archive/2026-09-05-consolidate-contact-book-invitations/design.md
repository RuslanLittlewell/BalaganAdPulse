## Context

See `proposal.md` for motivation. Invitations currently store a UUID-shaped code, one role, and lifecycle timestamps. Revocation is intentionally a timestamp rather than a physical delete, while the repository list returns all rows; this is why revoked invitations still appear in the network response even though the current Team UI filters them out. The contact book currently owns client contacts only, and invitation controls live on the Team page.

The API already follows module-first Clean/Hexagonal boundaries. The invitations module owns invitation lifecycle, identity consumes its redemption port, members own membership writes, and access grants are persisted separately. The change must preserve those ownership boundaries and transactional redemption.

## Goals / Non-Goals

**Goals:**

- Extend the invitation aggregate without allowing presentation or Prisma types into its application API.
- Keep historical invitation rows while making the ordinary list mean "actionable invitations".
- Resolve registration type publicly with minimal information disclosure.
- Move invitation composition into the contact-book widget without making entities depend on widgets or pages.
- Preserve atomic employee registration across identity, membership, project grants, and invitation claim.

**Non-Goals:**

- Implement the client registration form or client invitation redemption.
- Add an invitation-history UI or destructive deletion endpoint.
- Rename the explicitly requested `/regustration` route.
- Replace the current role/access model or introduce email delivery.

## Decisions

### Store invitation type and project selections relationally

Add an `InvitationType` enum (`CLIENT`, `EMPLOYEE`) to the invitation row, make its role nullable for client invitations, and add an invitation-to-project join table. Employee invites accept `ADMIN`, `MANAGER`, or `GUEST`; the `CLIENT` membership role is reserved for the later client-registration flow. A join table keeps referential integrity and supports transactional creation/redemption; a JSON project-id array would be simpler but could retain deleted or cross-organization identifiers silently.

Existing rows migrate to `EMPLOYEE`. Because older invites have no selected projects, they remain historical and are excluded from the actionable list unless safely backfilled; no existing row is deleted. New employee invitations require at least one project.

### Treat revocation as soft deletion and filter at the repository query

`GET /api/invites` will query only rows where `usedAt` and `revokedAt` are null and `expiresAt` is null or in the future. Filtering in persistence avoids returning history accidentally and explains the observed behavior directly. A query parameter filters `CLIENT` or `EMPLOYEE`; a future history endpoint can deliberately use a separate repository method.

Physical deletion was rejected because invitation redemption and audit need durable provenance.

### Generate eight-character codes through a dedicated port

Add a cryptographic invitation-code generator port distinct from the general UUID port. Use an unambiguous, URL-safe alphabet and eight characters. The application retries a bounded number of times when the repository reports a unique-code conflict; exhausting retries becomes an internal error. Database uniqueness remains the final concurrency guard.

Returning the relative `registrationUrl` from the application/API avoids environment-specific host configuration while ensuring the backend owns the exact `/regustration/{code}` format.

### Resolve form type through a narrow public use case

Mount an unauthenticated `GET /api/regustration/:code` route before authentication middleware. It calls a narrow resolver that applies normal redeemability rules and returns only `registrationType`. Every unusable code produces the same response, and the endpoint receives rate limiting to reduce enumeration risk.

The SPA may later add `/regustration/:code`; this change defines the URL and backend resolver only.

### Validate role and project authority in the application layer

Presentation validates request shape. The invitation use case validates that only `EMPLOYEE` accepts role/projects, that projects belong to the actor's organization, and that only `ADMIN` can grant `ADMIN`. These checks occur server-side even when the frontend hides disallowed controls.

Project grants are written through a port owned by the membership/access module during employee redemption. They share the identity registration transaction and therefore cannot partially apply.

### Compose invitation UI inside the contact-book widget

The contact book owns selector and modal-level state. Client and employee directory panes remain separate child components. An invitation feature component consumes invitation/project entities and is selected by contact type. The Team page retains member administration but loses all invite queries and controls.

### Compare deletion target with the fresh actor membership

Member removal rejects when the target membership id equals `ActorContext.membershipId`, before repository deletion. This is independent of the existing last-admin count rule and avoids relying on a stale token subject or UI-only disabling.

## Risks / Trade-offs

- [Eight characters provide less entropy than UUIDs] → Use a cryptographic generator, a sufficiently large unambiguous alphabet, database uniqueness, public lookup rate limiting, and uniform invalid-code responses.
- [Existing pending invitations cannot satisfy the new required project scope] → Preserve them as history but exclude them from the actionable list after migration; administrators create replacements.
- [Soft-deleted rows continue to consume unique codes] → Keep codes globally unique permanently so an old link can never acquire a new meaning.
- [A modal can become crowded] → Split client/employee panes and invitation form/list into focused components while retaining one modal shell.
- [The misspelled route becomes public API] → Treat `/regustration` as an explicit compatibility contract; correcting it later requires an alias or migration.

## Migration Plan

1. Add the invitation type enum, nullable role, and invitation-project join table. Backfill every existing invitation as `EMPLOYEE`; preserve all rows and timestamps.
2. Deploy backend reads/writes that understand the new schema, active-only listing, short-code generation, public resolution, and member self-removal protection.
3. Deploy the contact-book selector and invitation UI, then remove the Team invitation panel.
4. Existing pending legacy invites are no longer actionable because they lack project scope; admins issue replacements. Revoked, used, and expired records survive unchanged for history.

**Verified active-list outcome.** The migration is purely additive — `registration_type` arrives with a default of `EMPLOYEE`, `role` loses its NOT NULL, and the join table is created. No existing row is rewritten or removed, so every legacy invitation survives as an `EMPLOYEE` row with no project relations. After the deploy, `GET /api/invites` returns **none** of them, whatever lifecycle state they were in: an administrator opening the contact book sees an empty list and issues replacements. Attaching a project to a legacy row through persistence makes it actionable again, which is the backfill path for an operator who would rather not reissue.

One consequence is worth stating because it is surprising: a legacy **pending** link is hidden from the list but **still resolves publicly and can still be redeemed**. Redeemability is decided by the lifecycle timestamps alone, and a legacy row has none set. Redeeming one creates a member with the stored role and *no project grants* — able to sign in and reach nothing. Hiding it from the list does not kill the link; revoking the row does. Operators who need outstanding legacy links closed must revoke them explicitly as part of the deploy.

Rollback restores the previous application while leaving additive columns/table in place. New client invitations and nullable roles are not readable by the old application, so application rollback requires temporarily disabling invite endpoints or restoring the pre-deploy database snapshot; historical data itself is not intentionally deleted.
