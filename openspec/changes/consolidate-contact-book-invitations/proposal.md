## Why

Contact management and invitation management are split between the global contact book and the Team page, which makes onboarding hard to discover and leaves revoked invitations visible in the ordinary API response. A single contact directory should distinguish clients from employees and provide a safe, backend-owned invitation flow for both registration types.

## What Changes

- Add a Clients/Employees selector above the contact-book lists and show the selected directory inside the existing modal.
- Move employee invitation creation and the active invitation list from Team into the contact-book modal.
- Add client invitations whose links will eventually open a client-specific registration form.
- Require an employee invitation to name a role and one or more projects through a project multi-select.
- Permit only an admin to create an invitation granting `ADMIN`, while retaining server-side enforcement for all invitation permissions.
- Prevent an admin from deleting their own membership, in addition to the existing last-admin protection.
- Generate unique, cryptographically random eight-character invitation codes on the backend and expose complete `/regustration/{code}` links.
- Add a public invitation-resolution endpoint that tells the future registration page whether a valid link represents a client or employee form without exposing private invitation details.
- Change the ordinary invitation listing to return pending invitations only; revoked, used, and expired rows remain stored as history but no longer reappear after removal.
- **BREAKING**: invitation creation gains an explicit registration type; employee invitations require project selections, codes change from UUID-shaped values to eight characters, and the default list no longer returns historical invitations.

## Capabilities

### New Capabilities

- `contact-directory`: Unified client and employee browsing plus invitation management inside the contact-book modal.
- `registration-invitations`: Typed client/employee invitations, project-scoped employee onboarding, short backend-generated links, public form resolution, and active-only listing.
- `membership-admin-safety`: Restrictions around granting the admin role and deleting the acting administrator's own membership.

### Modified Capabilities


## Impact

- PostgreSQL and Prisma invitation schema, migration, repositories, use cases, HTTP validation, public routing, and invitation/member authorization.
- React contact-book widget, Team page, invitation entity contracts and queries, project selection UI, translations, and route constants.
- Existing invitation API consumers and tests must adopt typed creation inputs and active-only list semantics.
- Historical invitation rows remain available for audit or a future dedicated history endpoint; no destructive cleanup is required.
