## Why

The marker beside each project in the project list shows a priority someone set by hand
from the context menu. It goes stale the moment nobody updates it, and it says nothing
about how the project is actually doing. Media buyers want the list to show at a glance
which projects are on plan and which need attention, and the project's KPI already holds
that answer.

## What Changes

- The marker beside a project in the project list is painted from the project's progress
  against its KPI for the selected period, the same percentage the project's KPI tile
  shows, in the campaign indicator's zones: green from 100% (on plan, nothing needed),
  yellow from 80% up to 100% (somewhat behind, look closer and help), red below 80% (far
  behind, urgent measures), grey when the project has no KPI or its figure is not measured.
- The marker names that state to assistive technology instead of the priority.
- **BREAKING** The project priority is removed: the context menu no longer offers it, the
  API no longer returns `priority` on a project and ignores it on create and update, the
  `project-priority` permission is gone, and the `priority` column and its enum are dropped.
- The projects summary reading (`GET /api/summary/projects`) carries each project's KPI
  beside its figures, so the list draws every marker from that one request.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-list-layout`: the list's marker follows the project's KPI instead of its
  priority.
- `project-management`: customers are no longer told they cannot set a priority, since
  nobody can.
- `access-control`: a client's forbidden actions no longer include changing a priority.
- `campaign-metrics`: the projects summary reading carries each project's KPI.

## Impact

- Web: `widgets/project-list` (marker, context menu), `entities/project` (priority model
  removed, `Project` loses `priority`), `entities/campaign` (projects summary type),
  `features/kpi-target` (saving a project KPI refreshes the summary), copy in `ru.ts`,
  colour tokens in `tokens.css`.
- API: `modules/projects` (domain, schemas, use cases, OpenAPI), `modules/campaigns`
  (project reach port and adapter, projects summary, OpenAPI).
- `packages/access-policy`: the `project-priority` resource is removed.
- Prisma: `Project.priority` and the `project_priority` enum are dropped by a migration;
  stored priorities are lost.
