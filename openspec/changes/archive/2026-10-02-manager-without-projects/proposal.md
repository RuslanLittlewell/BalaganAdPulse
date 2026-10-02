## Why

An agency hires a manager before it knows which projects they will run, and often the
manager is the one who brings the project in. Today a `MANAGER` invitation is refused
unless it names at least one project, and a manager who creates a project under a client
they reach through a single-project grant cannot see the project they just made.

## What Changes

- A `MANAGER` invitation MAY name no projects. Redeeming it enrols a manager holding no
  access grants. `GUEST` invitations still require at least one project, since a guest
  cannot create anything and would reach nothing.
- The invitation dialog lets an admin send a manager invitation without choosing projects.
- A manager who creates a project is granted access to that project in the same
  transaction, so the creator always reaches what they created. The project belongs to the
  manager's organization — the agency that invited them — and every admin of it sees it.

## Capabilities

### New Capabilities

### Modified Capabilities
- `registration-invitations`: a manager invitation no longer requires projects.
- `project-management`: a manager who creates a project is granted access to it.

## Impact

- `apps/api/src/modules/invites/application/invite-use-cases.ts` — validation rule.
- `apps/api/src/modules/projects/application/project-use-cases.ts` — creator grant.
- `apps/web/src/features/invitations/ui/InvitationDialog.tsx` — projects optional for a manager.
- No schema change, no migration.
