## Context

A member's reach is a set of `client_access` rows; a row with a `project_id` reaches that
project alone. Rows are written today by the members module (`setAccess`, which replaces a
member's whole set and is admin-only through `member:update`) and by invitation redemption,
through `PrismaInvitationProjectAccess` — a members-module adapter implementing a port the
invites module declares. Project creation lives in the projects module and knows nothing of
members.

## Goals / Non-Goals

**Goals:** grant project-scoped access to chosen employees atomically with project creation.

**Non-Goals:** changing access while editing a project (the contact book already does that);
granting whole-client access; letting managers staff projects; notifying the assigned
employee; auditing the grant separately from the project's creation, which `setAccess` does
not do either.

## Decisions

- **`memberIds` on the create body, not a second call.** A follow-up `PUT
  /api/members/:id/access` per employee would replace each member's whole grant set, needs
  one round-trip per employee, and leaves a project without staff if the page closes midway.
  One optional field keeps creation atomic.
- **A port owned by the projects module, implemented in the members module.** `projects`
  declares `ProjectStaffing { eligible(orgId, ids) ; grant(context, project, ids) }`;
  `PrismaProjectStaffing` lives in `members/infrastructure` beside
  `PrismaInvitationProjectAccess`, which is the same shape of dependency, and composition
  wires it. The projects module stays ignorant of memberships and roles.
- **Eligibility is checked before the transaction.** The use case asks which of the named ids
  are active `MANAGER`/`GUEST` memberships of the actor's org and refuses with `validation`
  (400) unless all are. Admins reach everything already, customers must never be granted an
  agency project, and a foreign id must not leak whether it exists — one 400 covers all.
  Duplicates are collapsed before checking.
- **Authority is `can(actor, "update", "member")`,** the same verb that guards `setAccess`, so
  the UI's `useCan("update", "member")` hides the picker exactly where the API would refuse.
  It is checked only when the list is non-empty, so customers and managers keep creating
  projects unchanged.
- **Grants are inserted, not replaced,** with `skipDuplicates`; an employee's other grants are
  untouched.
- **The picker is the shared `MultiSelect`,** fed by `useMembers()` filtered to active
  managers and guests, rendered only when creating and `useCan("update", "member")`.

## Risks / Trade-offs

- [An employee is suspended between the check and the insert] → the grant is harmless: a
  suspended membership reaches nothing, and the contact book can revoke it.
- [Admins load the member list on opening the form] → it is the cached staff store already
  loaded by the rest of the app; no extra request once warm.

## Migration Plan

No schema change; existing data is untouched. Rollback is reverting the code.
