## Why

The header's online roster shows other people's pictures only to admins. Everyone else
sees initials, because a member's picture is served only to roles that may list members,
while the roster itself is shown to every member. Task cards and the responsible-member
picker lose pictures for the same reason.

## What Changes

- A member's picture is served to every member who may see that person in the online
  roster: staff see the pictures of everybody in their organization; a customer sees the
  pictures of the agency's staff and of people sharing one of their clients.
- Anybody else — another organization, or a customer of a different client — keeps
  getting 404, as for a member who does not exist.

## Capabilities

### New Capabilities

### Modified Capabilities
- `online-presence`: a person's picture is served to whoever the roster discloses them to.

## Impact

- `apps/api/src/modules/members/application/member-use-cases.ts` — picture permission.
- `apps/api/src/modules/presence/domain/presence.ts` — the disclosure rule accepts any
  person carrying an organization, a role and client ids.
- No web change, no schema change.
