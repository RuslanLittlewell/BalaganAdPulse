## 1. Backend schema and migration

- [x] 1.1 Drop `campaignId`, its `@relation`, its `@@index([campaignId])` from `model Task`,
  and the `tasks Task[]` back-relation from `model Campaign`, in `schema.prisma`.
- [x] 1.2 Write the Prisma migration that drops the column, its foreign key and its index.

## 2. Backend application and infrastructure layers

- [x] 2.1 Update `apps/api/test/tasks/task.application.test.ts` and
  `apps/api/test/tasks/task.prisma-adapter.test.ts` to drop every campaign-specific
  describe block and fixture field (`campaignId`, the `campaigns: CampaignReach` stub), and
  run them to see them fail against the still-campaign-aware implementation.
- [x] 2.2 Remove `campaignId` from `TaskRecord`, `NewTask`, `TaskChange` and `TaskFilter` in
  `apps/api/src/modules/tasks/application/ports.ts`; remove the `CampaignReach` port and the
  `campaigns: CampaignReach` field from `TaskDependencies`.
- [x] 2.3 Remove `assertCampaignInProject` and every call to it, and the
  `releasesCampaign`/`campaignId` handling, from
  `apps/api/src/modules/tasks/application/task-use-cases.ts`.
- [x] 2.4 Remove `campaignId` handling from
  `apps/api/src/modules/tasks/infrastructure/prisma-task-repository.ts` (`toDomain`,
  `listReachable`, `update`).
- [x] 2.5 Delete `PrismaCampaignInProject` from
  `apps/api/src/modules/campaigns/infrastructure/prisma-campaign-repositories.ts`, and
  remove the `campaigns: new PrismaCampaignInProject(prisma)` wiring from
  `apps/api/src/composition/create-container.ts`.
- [x] 2.6 Run `npm test` (backend) until `task.application.test.ts` and
  `task.prisma-adapter.test.ts` are green.

## 3. Backend presentation layer and the org-wide campaign-names endpoint

- [x] 3.1 Update `apps/api/test/tasks/task.api.test.ts` and
  `apps/api/test/tasks/task-without-project.api.test.ts` to drop their campaign-specific
  describe blocks and assertions, and run them to see them fail.
- [x] 3.2 Remove `campaignId` from `createTaskSchema`, `updateTaskSchema` and
  `taskFilterSchema` in `task-schemas.ts`; from the query parsing in `task-http.ts`; and
  from the Task schema, list query schema and description text in `task-openapi.ts`.
- [x] 3.3 Move `describe("GET /api/projects/:projectId/campaigns/names")` out of
  `task.api.test.ts` into the campaigns test suite (it exercises a campaigns-module endpoint
  the CRM lead form still uses, not a task-module concern) if it is not already covered
  there; delete `describe("GET /api/tasks?campaignId=")`.
- [x] 3.4 Delete the `GET /api/campaigns/names` route, its controller/service code and its
  OpenAPI entry; delete `describe("GET /api/campaigns/names")` from
  `apps/api/test/campaigns/campaign-references.api.test.ts`, keeping the per-project
  describe block.
- [x] 3.5 Run `npm test` (backend) until every backend test file is green.

## 4. Frontend entities/task layer

- [x] 4.1 Update `apps/web/test/entities/task/useTasks.test.tsx` and
  `apps/web/test/entities/task/taskEvents.test.ts` to drop their campaign-filter assertions
  and fixtures (`onCampaign`, "ignores a task belonging to another campaign", "drops a task
  whose campaign changed to another one"), and run them to see them fail.
- [x] 4.2 Remove `campaignId` from `Task`, `TaskInput` and the `list()` query param in
  `apps/web/src/entities/task/api/api.ts`.
- [x] 4.3 Shrink the `useTasks` query key from `["tasks", projectId, campaignId]` to
  `["tasks", projectId]` in `apps/web/src/entities/task/api/queries.ts`, and update
  `TaskListFilter`, `matchesFilter` and `filterOfKey` for the shorter tuple.
- [x] 4.4 Update `apps/web/src/entities/task/api/applyTaskEvent` (or wherever the WS
  event-filtering logic lives) and `useTaskEvents` for the shorter key.
- [x] 4.5 Remove the stray `campaignId: null` from `aTask()` in `apps/web/test/shared/fixtures.ts`
  and from the inline task fixtures in `applyMove`, `useMoveTask`, `useRescheduleTask` and
  `useTaskEvents` test files.
- [x] 4.6 Run `npm run test:web` until every `entities/task` test file is green.

## 5. Frontend task form and read-only dialog

- [x] 5.1 Update `apps/web/test/features/task-management/TaskFormDialog.test.tsx`,
  `TaskContentBlocks.test.tsx`, `TaskFormLayout.test.tsx` and `TaskPreviewDialog.test.tsx`:
  remove their campaign-specific describe blocks and msw handlers, and adjust the
  "brings the project, the campaign and the responsible member in one block" /
  "clears the project, the campaign and the responsible member together" style assertions
  to name only the project and the responsible member. Run them to see them fail.
- [x] 5.2 Remove the campaign `<Select>` and its `Controller`/`FieldError` from the `assign`
  block in `TaskFormDialog.tsx`; remove `campaignId`/`WHOLE_PROJECT` from `FormValues`,
  `FORM_FIELDS`, the default values, the submit body and the project-change effect; remove
  the now-unused `useProjectCampaignNames`/`channelLabel` import.
- [x] 5.3 Remove `campaignId`/`wholeProject` from `BlockValues`/`BlockPlaceholders` and the
  campaign clause from `filledBlocks` in
  `apps/web/src/features/task-management/model/blocks.ts`.
- [x] 5.4 Remove the "Кампания" `Fact` and its `useProjectCampaignNames` lookup from
  `TaskPreviewDialog.tsx`.
- [x] 5.5 Run `npm run test:web` until every `features/task-management` test file is green.

## 6. Frontend read-only board and calendar surfaces

- [x] 6.1 Update `apps/web/test/widgets/task-board/TaskBoardLayout.test.tsx` and
  `apps/web/test/pages/tasks/TasksRequests.test.tsx`: remove the campaign-line assertions
  (`task-campaign-<id>`, "names the campaign the work is about", "says Общий...", "carries
  the campaign through from the board", "asks for no campaign names...") and their msw
  handlers. Run them to see them fail.
- [x] 6.2 Remove the `campaignName` prop and the `task-campaign-<id>` line from
  `TaskCard.tsx`'s footer.
- [x] 6.3 Remove the `campaigns`/`campaignName` prop plumbing from `TaskColumn.tsx` and
  `TaskBoard.tsx` (including the drag-overlay card and the `useCampaignNameById` call).
- [x] 6.4 Remove the campaign segment from `CalendarTaskEvent`'s footer and the
  `campaignName` prop from its props, and the `campaigns`/`campaignName` plumbing from
  `TaskCalendar.tsx` and `CalendarDay.tsx`.
- [x] 6.5 Run `npm run test:web` until every `widgets/task-board` and `widgets/task-calendar`
  test file is green.

## 7. CampaignPage and the org-wide campaign-names store

- [x] 7.1 Update `apps/web/test/pages/campaign/CampaignPage.test.tsx` to drop the "Задачи
  кампании" list assertions, and run it to see it fail.
- [x] 7.2 Remove the task list section, `useTasks({ campaignId })`, `TaskPreviewDialog` usage
  and the `reading` state from `CampaignPage.tsx`.
- [x] 7.3 Delete `apps/web/test/entities/campaign/campaignNames.test.tsx`, then
  `apps/web/src/entities/campaign/model/campaignNames.ts` and
  `apps/web/src/entities/campaign/model/CampaignNamesSync.tsx`, their barrel exports in
  `entities/campaign/index.ts`, the `names()` call and `ProjectCampaignReference` re-export
  in `entities/campaign/api/api.ts` if unused elsewhere, and the `<CampaignNamesSync />`
  usage plus its import in `TasksPage.tsx`.
- [x] 7.4 Remove the `resetCampaignNames` import and call from `apps/web/test/shared/setup.ts`
  and the `/api/campaigns/names` default handler from `apps/web/test/shared/handlers.ts`.
- [x] 7.5 Run `npm run test:web` until every `pages/campaign` and `pages/tasks` test file is
  green.

## 8. Translations and full verification

- [x] 8.1 Remove `tasks.form.campaign`, `tasks.form.wholeProject`, `tasks.ofCampaign.title`
  and `tasks.ofCampaign.empty` from `apps/web/src/shared/config/ru.ts`.
- [x] 8.2 Run `npm test` (backend) and `npm run test:web` (frontend) from a clean tree until
  both are fully green, then `npm run build -w apps/api` and
  `npm run build -w @adpulse/web` until both are clean.

## 9. Close the change

- [x] 9.1 Run `openspec validate remove-task-campaign --strict` and confirm the
  implementation matches every scenario in the delta specs.
- [x] 9.2 Check `README.md` and any other docs describing a task's fields or the task form
  for a campaign mention, and update them.
