## Why

The CRM keeps one funnel for the agency and one per client, but the agency's work is
organized by project: every lead the agency handles comes from, and is worked for, one
project. A client with several projects mixes their prospects on one board, the project on a
lead is an optional afterthought, and the agency funnel is not used for anything the product
needs.

## What Changes

- **BREAKING** The agency funnel is removed, together with every lead and custom column on it.
- **BREAKING** A funnel belongs to a project, not to a client. Every project has its own board,
  and a lead always belongs to the project of its board. The lead form no longer offers a
  project choice; the campaign choice lists the board project's campaigns.
- **BREAKING** Data migration: leads with no project are deleted; every custom column is
  deleted and the leads that sat in one move to the end of Новый. Leads that name a project
  move to that project's board. This loses data and cannot be undone.
- Custom columns keep working, per project board.
- Deleting a project deletes its funnel's leads and columns, instead of leaving the leads with
  no project. Moving a project to another client takes its funnel along.
- The CRM selector lists the projects the member reaches, named by project with its client
  beside it. A customer with more than one project sees the selector too; a customer with one
  project opens it directly.
- Who reaches a board follows who reaches the project: a project-only grant now reaches that
  project's funnel, which it previously did not.
- Meta-imported leads land on the board of the connected project.

## Capabilities

### Modified Capabilities
- `lead-crm`: funnels per project instead of agency and client funnels; a lead's project is its
  board; the selector lists projects; deleting a project removes its funnel; columns belong to a
  project board.
- `access-control`: CRM board reach follows project reach.
- `meta-lead-import`: imported leads land on the project's board.
- `lead-calendar`: the reach scenario stops naming the agency board.

## Impact

- **Database**: migration deleting agency leads, leads without a project and all custom
  columns; `lead.client_id` and `lead_column.client_id` are dropped; `lead.project_id` becomes
  required and `lead_column.project_id` is added, both cascading on project deletion.
- **API** (`apps/api`): leads module (repository, use cases, schemas, intake), the Meta lead
  poll worker's delivery target, realtime lead delivery (board key is a project id), and their
  tests.
- **Web** (`apps/web`): CRM page selector, lead form (no project field, `AGENCY_BOARD` removed),
  lead types and tests.
