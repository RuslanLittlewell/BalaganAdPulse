## Why

A client who starts a new product has to ask the agency to create its project, and customer accounts cannot fix a typo in their own project's name or budget. Clients should set up their own projects, and the agency should see them straight away in the same projects module.

## What Changes

- `CLIENT` and `CLIENT_ADMIN` members can create projects for their own client and edit the name, niche, monthly budget, currency and picture of their client's projects.
- A project a client creates belongs to that client, so the agency's admins, and staff who reach that client, see it in the projects module and dashboard like any other project.
- Deleting a project, changing its priority, managing its Meta connection and setting project or campaign KPIs stay with agency staff.
- The shared permission matrix gains `integration`, `kpi` and `project-priority` resources so those agency-only actions no longer ride on project update permission.
- In the interface, customers get the "+" in the projects list and the edit action. The project form fixes the client to their own and offers no client creation or deletion. The priority menu, Meta panel and KPI editing stay hidden from them.
- No **BREAKING** API changes: the same endpoints accept customers where the matrix now allows them.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `access-control`: customers create and edit their own client's projects; agency-only project actions are named in the matrix.
- `project-management`: customers' project creation and editing flow and its visibility to the agency.
- `meta-project-integration`: connection and refresh require the integration permission instead of project update permission.
- `kpi-targets`: project and campaign KPIs require the KPI permission instead of project or campaign update permission.

## Impact

- Shared policy package: new resources and wider project create and update rows.
- Backend: project use cases refuse priority changes without `project-priority`; integration and KPI use cases check their own resources.
- Frontend: project list controls, project form client field for customers, Meta panel and KPI edit gating.
- Tests: policy matrix, project, integration and KPI API tests, and the affected web components.
