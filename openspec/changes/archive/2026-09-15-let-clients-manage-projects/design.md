## Context

The shared matrix in `@adpulse/access-policy` answers both API and UI. `project.update` currently gates four things:
- project edits;
- the project's priority menu;
- Meta integration settings, both reads and writes;
- project KPIs.

Campaign KPIs use `campaign.update`. Customers reach their client through whole-client grants.

## Goals / Non-Goals

**Goals:** customers create and edit their own client's projects through the existing endpoints and forms, while agency-only actions keep their current audience.

**Non-Goals:**
- customers deleting projects or managing campaigns;
- notifications to the agency about new client projects;
- field-level edit history.

## Decisions

### Agency-only actions get their own matrix resources

Add resources to the matrix:
- `integration`: every verb for STAFF.
- `kpi`: read for everyone; create, update and delete for STAFF.
- `project-priority`: read for everyone; update for STAFF.

Widen `project` create and update to STAFF and customers; delete stays ADMIN.

The integration use cases check `can(actor, "update", "integration")`. The KPI use cases check `can(actor, "update", "kpi")` for projects and campaigns. The organization KPI keeps `organization.update`.

A field-level `isCustomer` check was rejected because the matrix must stay the one source both sides read.

### Priority is refused, not silently ignored

`create` and `update` in the project use cases refuse any `priority` in the input without `project-priority.update` (403). A customer's project therefore starts at the default priority, and a request trying to change it is visibly refused.

### The form fixes a customer's client

`ProjectFormDialog` reads the actor's reachable client from `useAuth().clientIds` when the member is a customer. It preselects that client and disables the select. "Новый клиент" is already absent because customers cannot create clients.

In `ProjectList`:
- the create control stays behind `Can create project`;
- edit follows `project.update`;
- the priority menu follows `project-priority.update`.

The Meta panel follows `integration.update`, and KPI editing follows `kpi.update`.

## Risks / Trade-offs

- [Managers holding only project grants will not see a client-created project] → Consistent with existing reach; admins and whole-client managers see it.
- [Existing tests encode customers as project read-only] → Updated alongside the matrix change.
