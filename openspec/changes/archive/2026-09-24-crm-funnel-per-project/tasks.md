## 1. Schema and migration

- [x] 1.1 Change `schema.prisma`: drop `Lead.clientId` and `LeadColumn.clientId` with their relations
  and indexes; make `Lead.projectId` required with `onDelete: Cascade`; add a required
  `LeadColumn.projectId` with `onDelete: Cascade` and an index; update the back-relations on
  `Client` and `Project`.
- [x] 1.2 Write the migration SQL following design.md's plan, and verify it on a copy of the local
  database holding agency leads, unattributed leads, custom columns and leads in them.

## 2. The API keys boards by project

- [x] 2.1 Rewrite the leads tests (`test/leads/**`, the realtime CRM tests, the Meta lead import
  tests and the dashboard stage-count tests) for project boards: board listing and order,
  reach for admin, project-only grant, whole-client grant and customers, 404 for `agency`,
  400 for a request naming a project, campaign limited to the board project, columns per
  project, cascade on project and client deletion, and imported leads on the project board.
  Run them and see them fail.
- [x] 2.2 Rework `PrismaLeadRepository`, `lead-use-cases.ts`, `lead-schemas.ts`, the lead domain
  types and the OpenAPI component for project boards.
- [x] 2.3 Rework the lead intake (`lead-intake.ts`, `prisma-lead-intake-repository.ts`) and the Meta
  lead poll worker to lock, shift and announce by project.
- [x] 2.4 Run `npm test` until green.

## 3. The web

- [x] 3.1 Update the web tests for the CRM page, the lead form and the lead entity: selector
  labels with client names, the customer selector with several projects, no project field in
  the lead form, campaigns of the board project. Run them and see them fail.
- [x] 3.2 Remove `AGENCY_BOARD` and the project field from `LeadFormDialog`, show the client name
  in the selector, and drop `projectId` from `LeadInput`.
- [x] 3.3 Run `npm run test:web` until green.

## 4. Close the change

- [x] 4.1 Run `npm test`, `npm run test:web`, and both builds until green.
- [x] 4.2 Run `openspec validate crm-funnel-per-project --strict`.
