## Why

The dashboard's project table shows advertising figures but not how far a project's leads have progressed in CRM. Members compare projects by lead quality, so they open each client's board and count cards by hand.

## What Changes

- The dashboard project table's column chooser offers four more columns, one per fixed CRM stage: Лид (Новый), Лид (Квалифицированный), Лид (Целевой) and Лид (КП). They are hidden until a member turns them on, and the choice is remembered like other column choices.
- Each cell counts the project's leads that arrived within the selected period and are currently in that stage. A Meta lead arrives when its form was submitted; any other lead arrives when it was created.
- Leads in custom columns, leads without a project and leads on boards the member cannot reach are not counted.
- New endpoint `GET /api/crm/project-stage-counts?from=&to=` returns the counts per project without any lead contact data.
- Project campaign and campaign tables are unchanged.

## Capabilities

### New Capabilities

### Modified Capabilities
- `lead-crm`: adds period lead counts per project and fixed stage, and their optional columns in the dashboard project table.

## Impact

- API: leads module gains a counting query, use case, route and OpenAPI entry. No schema change.
- Web: lead entity gains a counts query; the performance table accepts optional extra columns that start hidden; the dashboard project table supplies the four stage columns.
