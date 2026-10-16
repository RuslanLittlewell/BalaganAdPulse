## Why

A client an admin enters is invisible to every manager until the admin grants it to them
one by one in the member's access settings, so managers cannot find the agency's clients,
pick them in the project form or start work on them. The agency treats its client list as
shared: every manager works across it, and grants exist to narrow which projects a member
works on, not which customers they may know about.

## What Changes

- A `MANAGER` reaches every client of their organization: the client list, reading and
  editing a client, and choosing it as the client of a new project. Deleting a client
  stays admin-only.
- Project, campaign, task and audit reach for a manager is unchanged: it still comes from
  access grants, so seeing a client does not reveal its projects.
- `GUEST`, `CLIENT` and `CLIENT_ADMIN` reach is unchanged.
- A manager who creates a client still receives a whole-client grant, so they reach that
  client's projects.
- **BREAKING** for API consumers relying on the old rule: `GET /api/clients` for a
  manager returns every client of the organization, and `GET /api/clients/:id` no longer
  answers 404 to a manager for an ungranted client of their organization.

## Capabilities

### New Capabilities

### Modified Capabilities
- `access-control`: managers reach every client of their organization; guests keep
  grant-only reach; project reach stays grant-based for both.
- `client-management`: a client one member creates is visible to every manager.

## Impact

- `apps/api/src/modules/clients/infrastructure/prisma-client-repository.ts` — client reach
  filter.
- Consumers of client reach (project creation, session `clientIds`, presence) follow it
  without code change; presence only compares customers' client ids.
- No schema change, no migration.
