## Context

`reachableProjects` lets a non-admin reach a project through a whole-client grant (`client_access.project_id IS NULL`) or a grant naming that project. CRM boards for customers require a whole-client grant. `client_access.project_id` cascades on project deletion, so a project-only grant disappears with its project.

## Decisions

- **Grant port.** `InvitationProjectAccess` gains `grantClient(context, membershipId, clientId)`, which writes one whole-client grant. Client registration and client-staff joining call it. The client-projects lookup used only by joining is removed.
- **Role.** Client registration enrols `CLIENT_ADMIN`, matching the principal requirement. Joining still enrols `CLIENT`.
- **Data repair in a migration.** For customer memberships (`CLIENT`, `CLIENT_ADMIN`), the migration:
  - inserts a whole-client grant for every client they hold a project-only grant on, unless one exists;
  - deletes their project-only grants;
  - promotes memberships whose user redeemed a `CLIENT` registration invitation to `CLIENT_ADMIN`.

  Staff grants are untouched.
- **Accounts without any grant** carry no trace of their client in the data (a client invitation names no client), so the migration leaves them. An admin can grant them.

## Risks / Trade-offs

- [Customers now see every project of their client] → Intended by the existing access requirements; staff project-only grants are unchanged.
- [Promotion could make a later-joined colleague a principal] → Only accounts that redeemed a `CLIENT` registration link are promoted; joining links are `CLIENT_STAFF`.

## Migration Plan

1. Add a data-only migration with the grant insertion, project-grant deletion and principal promotion. No schema changes. Existing data survives and customer reach only widens to their own client.
2. Apply it to a copy of the populated development database and verify grants and roles.
3. Deploy with the application. Rollback: the application keeps working with whole-client grants; restoring project-only grants is unnecessary.
