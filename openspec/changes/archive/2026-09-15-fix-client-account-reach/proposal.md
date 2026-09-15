## Why

A customer account can lose sight of its own client. Registering from a client link grants the new account one project instead of the client, and enrols it as an ordinary `CLIENT`. When that project is deleted, the grant goes with it, and the account reaches nothing: no projects, no CRM board, not even its client. Customers joining a client likewise get grants for the projects that existed at that moment, so later projects stay invisible. Both contradict the existing `access-control` and `registration-invitations` requirements: a customer reaches the client named by their grant and all its projects, and whoever registers the client is its principal.

## What Changes

- Registering from a client link enrols the account as the client's `CLIENT_ADMIN` with a whole-client grant.
- Joining a client grants the whole client instead of its current projects.
- A data migration gives every customer membership that holds project-only grants a whole-client grant for those clients and removes the redundant project grants. It also promotes accounts that redeemed a client registration link to `CLIENT_ADMIN`.
- The empty project list reads "Проектов пока нет" without wrapping.
- No API contract or requirement changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This restores the `access-control` and `registration-invitations` contracts; no requirement changes.

## Impact

- Backend: invitation redemption grants and roles, the invitation access adapter, and a data-only migration.
- Frontend: the project list empty state.
- Existing customer accounts gain reach over their whole client. Accounts whose only grant was already deleted cannot be matched to a client by data and need a grant from an admin.
