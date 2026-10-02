## Why

A task can currently name one campaign of its project, on top of the project itself — a
third, narrower level of "what this is about" that the product no longer wants tasks to
carry. Tasks are agency work items, not campaign-scoped reporting; naming a campaign on a
task added a field, a select, a read-only fact and a listing filter that nobody asks for
today. Removing it simplifies the task form to project + responsible member and removes a
whole class of validation (a campaign must belong to the task's project) that existed only
to protect a relationship the product no longer wants.

## What Changes

- **BREAKING** A task no longer names a campaign. `Task.campaignId` is dropped from the
  schema, the API request/response shapes, and every screen that showed or filtered by it.
- The `Назначить` block in the task form now carries only the project and the responsible
  member; the campaign select is removed from it.
- The task preview surfaces (Kanban card, calendar card, the read-only task dialog) no
  longer show a campaign line. They keep showing the project.
- The task listing no longer accepts a campaign filter, and `CampaignPage`'s "Задачи
  кампании" section — the only screen that listed a campaign's own tasks — is removed
  outright, since there is no longer a relationship to list by.
- **BREAKING** The organization-wide campaign names listing (`GET /api/campaigns/names`)
  is removed along with the frontend store built on it (`useCampaignNames`,
  `useProjectCampaignNames` used by tasks, `useCampaignNameById`, `CampaignNamesSync`).
  It existed solely to let the task board and task form show a campaign's name without a
  reading per project; with no task naming a campaign, it has no remaining caller. The
  per-project campaign names listing (`GET /api/projects/:projectId/campaigns/names`),
  which the CRM lead form also depends on, is unaffected and stays exactly as it is.
- Completing a repeating task, which currently lists "campaign" among the fields it leaves
  untouched, drops that mention — there is no longer a campaign to leave untouched.

## Capabilities

### New Capabilities

### Modified Capabilities
- `task-board`: a task no longer names a campaign — the requirements that let it, that
  released the campaign on a project move, that kept a task standing when its campaign was
  deleted, and that listed a campaign's tasks are removed; the requirements that describe
  the task form's blocks, the read-only task view, the project/campaign work-in-flight
  listing and the board's own-work rule are narrowed to drop campaign wherever it appeared
  alongside project.
- `campaign-metrics`: campaign reference listings drop their organization-wide form (used
  only by tasks); the per-project form, still used by the CRM lead form, is unchanged.

## Impact

- **API** (`apps/api`): `Task.campaignId` column, its foreign key and its index are
  dropped in a new Prisma migration; the `Campaign.tasks` back-relation goes with it. The
  task create/update/filter Zod schemas, the OpenAPI task schema, the task use-cases
  (including the `assertCampaignInProject` guard and the `CampaignReach` port), the Prisma
  task repository, and the task HTTP layer all drop `campaignId`. `GET /api/campaigns/names`
  and the `PrismaCampaignInProject` class (which backed only that guard) are deleted.
- **Web** (`apps/web`): `TaskFormDialog`, `TaskPreviewDialog`, `blocks.ts`, `TaskCard`,
  `TaskColumn`, `TaskBoard`, `CalendarTaskEvent`, `TaskCalendar`, `CalendarDay` and
  `CampaignPage` all lose their campaign-related props, fields and rendering.
  `entities/campaign/model/campaignNames.ts` and `CampaignNamesSync.tsx` are deleted, along
  with their barrel exports. `useTasks`'s query key shrinks from
  `["tasks", projectId, campaignId]` to `["tasks", projectId]`, which ripples into
  `filterOfKey`, `applyTaskEvent` and `useTaskEvents`.
- **Translations**: `tasks.form.campaign`, `tasks.form.wholeProject`,
  `tasks.ofCampaign.title` and `tasks.ofCampaign.empty` are removed from `ru.ts`.
- **Tests**: every frontend and backend test asserting task+campaign behavior is removed or
  rewritten; the backend campaign-references suite for `GET /api/campaigns/names` is
  deleted, the one for the per-project endpoint is untouched.
- **Data**: existing tasks that name a campaign lose that value when the migration runs —
  accepted, since the feature is going away entirely, not being hidden.
