## Context

`createInviteUseCases.create` refuses a `MANAGER` or `GUEST` invitation without projects.
Redemption already handles an empty project list (`projectAccess.grant` with `[]`), as
admin invitations prove. Project reach for a manager is the union of whole-client grants
(`ClientAccess.projectId = null`) and project grants. A manager who creates a client gets a
whole-client grant; a manager who creates a project gets nothing, so a project made under
a client reached through another project's grant is invisible to its creator.

## Goals / Non-Goals

**Goals:**
- Enrol a manager with no projects.
- Let that manager create projects in their own organization and reach them.

**Non-Goals:**
- Letting a manager see or pick clients they hold no grant for. The client picker keeps
  showing reachable clients; a manager without any creates one from the project form.
- Relaxing the rule for guests, who may not create anything.

## Decisions

- **Split the project requirement by role in the invite use case.** `GUEST` keeps the
  "at least one project" check; `MANAGER` skips it but still validates any projects named
  against the organization.
- **Grant the creating manager through `ProjectStaffing.grant`.** It already writes a
  project-scoped `ClientAccess` row with `skipDuplicates`, inside the creation transaction.
  The use case appends the actor's membership to the granted list when the actor is a
  `MANAGER`. The eligibility check is not applied to the actor — they are the actor, and
  their role is already known. Admins reach everything and customers reach their client
  whole, so neither needs a grant.
- **Organization comes from the actor.** The project's client must be reachable by the
  actor, and every reachable client belongs to `actor.orgId`, so the project lands in the
  agency that enrolled the manager without new input.

## Risks / Trade-offs

- A manager holding a whole-client grant also receives a redundant project grant. It is
  harmless, and removing a manager's whole-client grant later then leaves them the
  projects they created, which is the intended outcome.
- No schema change; existing data is untouched.
