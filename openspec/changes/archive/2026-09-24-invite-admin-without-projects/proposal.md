## Why

An admin reaches every client and project of the organization without any access grant, yet
an admin invitation must still name at least one project. The choice is meaningless, and the
grants it leaves behind clutter the new admin's access list in the contact book.

## What Changes

- An `EMPLOYEE` invitation with role `ADMIN` carries no projects. Naming projects on one is
  refused with 400.
- `MANAGER` and `GUEST` invitations still require at least one project.
- The invitation dialog hides the project picker while the chosen role is Администратор and
  sends the invitation without projects.

No breaking change for managers and guests. A client that sends projects with an admin
invitation now gets 400 instead of 201. The only such client is the web app, which changes
in this change.

## Capabilities

### Modified Capabilities
- `registration-invitations`: the requirement defining an employee invitation's fields makes
  projects required for managers and guests and forbidden for admins.

## Impact

- **API** (`apps/api`): `createInviteSchema` stops requiring a non-empty `projectIds`; the
  invite use case enforces the per-role rule. Redemption already grants whatever projects the
  invitation carries, which is none for an admin. No schema change.
- **Web** (`apps/web`): `InvitationDialog`.
