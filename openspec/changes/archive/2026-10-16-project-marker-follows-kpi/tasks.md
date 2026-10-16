## 1. The project priority is gone from the API

- [x] 1.1 Drop `Project.priority` and the `ProjectPriority` enum from the Prisma schema and add the migration that drops the column and the `project_priority` type
- [x] 1.2 Remove `priority` from the projects module's domain, schemas, use cases and OpenAPI document, and the `project-priority` resource from `@adpulse/access-policy`
- [x] 1.3 Cover it: projects are returned without a priority, a priority sent on create or update is ignored, a client's agency-only project actions no longer mention it; update the policy matrix test; `npm test` green

## 2. The projects summary carries each project's KPI

- [x] 2.1 Return each reachable project's KPI from `ProjectReach.listReachable` and its Prisma adapter, add `kpi` to every projects summary entry and to its OpenAPI schema
- [x] 2.2 Cover it: a project with a KPI, a project without one whose campaign has one; `npm test` green

## 3. The list's marker follows the KPI

- [x] 3.1 Remove the web priority model, the `priority` field of `Project`, its copy and its colour tokens, and the context menu's priority group
- [x] 3.2 Add `kpi` to `ProjectFigures`, `projectTone` in the project list, the marker tokens and copy, and draw every row's marker from the projects summary over the selected period
- [x] 3.3 Invalidate the projects summary when a project KPI is saved or cleared
- [x] 3.4 Cover it: the tone's thresholds, lower-is-better and unmeasured cases; the list's marker names the state for a project with and without a KPI, follows the period and a newly saved KPI; the context menu offers no priority; drop the priority refresh test, whose reload behaviour the projects store's own test keeps covered; `npm run test:web` green
- [x] 3.5 Remove the priority from the `project-management` spec's purpose; `openspec validate project-marker-follows-kpi --strict`
