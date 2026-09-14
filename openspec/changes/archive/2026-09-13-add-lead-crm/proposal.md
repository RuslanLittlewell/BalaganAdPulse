## Why

The agency and its clients need to track prospects from first contact to a sales outcome. The task board tracks delivery work; a dedicated CRM will track lead contacts, acquisition sources and sales stages within separate agency and client funnels.

## What Changes

- Add a CRM navigation entry and Kanban page using the task board's visual language and drag interactions.
- Provide one agency funnel per organization and one funnel per client, independent of projects.
- Show an upper-left board selector for agency staff, limited to authorized boards; customer members see only their own board.
- Introduce eight fixed stages: Новый лид, Связались, Квалифицирован, Предложение, Переговоры, Выигран, Проигран, Отложен.
- Add lead creation, detail editing, deletion, stage changes and ordering, with lead identity, company, contact details and acquisition source.
- Let customer roles manage leads on their own board; guests remain read-only. Audit mutations and synchronize open CRM boards.
- Winning a lead changes its status only in every funnel. It does not create a client, account, project or invitation.
- Existing data and task-board behavior remain compatible; no breaking API changes.

## Capabilities

### New Capabilities
- `lead-crm`: Separate funnels, lead fields, stages, ordering, board interface, audit and realtime behavior.

### Modified Capabilities
- `access-control`: Add CRM scope rules and allow customer roles to manage their own leads without widening existing resource permissions.

## Impact

- Prisma: additive lead model, stage enum and indexes; existing records survive.
- Backend: new leads module using the existing domain/application/infrastructure/presentation boundaries, composition wiring, REST and OpenAPI contracts, audit and realtime integration.
- Shared access policy: new lead resource and board reach checks.
- Frontend: CRM page, lead entity and editing features, board selector, navigation and Russian UI labels; reuse task-board styling and interaction primitives.
- Tests: database constraints, cross-board authorization, mutations, concurrent moves, UI and realtime isolation. No new external services or data import integrations.
