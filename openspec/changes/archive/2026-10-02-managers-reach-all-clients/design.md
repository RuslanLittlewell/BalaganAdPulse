## Context

Client reach is one Prisma filter in the client repository: an `ADMIN` reaches every
client of the organization, every other role reaches a client only through a
`ClientAccess` row. The same reach answers `reachableIds`, which the project use cases
(may this actor create a project under this client), the invitation use cases, the
session's `clientIds` and presence consume. Project reach is a separate filter in the
project repository, built directly on `ClientAccess`.

## Goals / Non-Goals

**Goals:**
- A manager sees and edits every client of their organization and may create projects
  under any of them.

**Non-Goals:**
- Widening a manager's project, campaign, task or audit reach.
- Changing guest or customer reach.

## Decisions

- **Widen the client reach filter for `MANAGER`, not grant on creation.** Granting every
  manager on every client creation would miss managers enrolled later and clients created
  before, and would also open every project of those clients through the whole-client
  grant. Treating `MANAGER` like `ADMIN` in the client filter only touches client reach.
- **Keep the manager's whole-client grant on creating a client.** It is what lets the
  creator reach the client's projects; the client filter no longer needs it.
- **Leave `reachableIds` consumers as they are.** Project creation then accepts any client
  of the organization from a manager, which is what the picker now shows; presence only
  compares customers' client ids; the web reads `clientIds` only for customers; inviting
  is admin- and client-admin-only.

## Risks / Trade-offs

- [A manager can edit any client's contact fields] → editing was already a manager verb;
  the audit trail records who changed what.
- [A manager's client list grows with the agency] → the list is unpaginated today, same as
  an admin's; no new cost beyond what admins already incur.

## Migration Plan

No schema change; existing grants keep their meaning for project reach. Rolling back is
reverting the filter.
