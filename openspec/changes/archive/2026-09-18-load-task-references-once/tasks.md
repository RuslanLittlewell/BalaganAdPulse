## 1. Campaign references for the whole organization

- [x] 1.1 Write and observe failing API tests for `GET /api/campaigns/names`: every campaign
  of the projects a manager reaches, each naming its project, nothing from a project they do
  not reach, an empty listing for a member who reaches nothing, and no measured figures on
  any of them.
- [x] 1.2 Add the use case over the repository's existing `listReachable`, the route and its
  OpenAPI operation, leaving the per-project listing as it is.
- [x] 1.3 Run `npm test` and `npm run test:web` until both are green.

## 2. Projects are loaded once for the session

- [x] 2.1 Write and observe failing web tests for the projects store: it loads once however
  many callers ask, concurrent callers share one request, a refresh reloads it, and a reset
  empties it.
- [x] 2.2 Add `entities/project/model/projects.ts` in the shape of the staff store, with a
  `useProjects` that keeps the result shape its callers read and filters by client from the
  store.
- [x] 2.3 Mount `ProjectsSync` beside `StaffSync` in `App.tsx`, and refresh the store from the
  four project mutations instead of invalidating the query key.
- [x] 2.4 Write and observe a failing web test for opening a task card asking the server for
  no project list, then make it pass.
- [x] 2.5 Run `npm test` and `npm run test:web` until both are green.

## 3. Campaign names are loaded once for the task module

- [x] 3.1 Write and observe failing web tests for the campaign-name store: one request fills
  it, a second caller asks for nothing, a reset empties it, and references are read back by
  project.
- [x] 3.2 Add `entities/campaign/model/campaignNames.ts` in the shape of the staff store, over
  the new organization-wide listing.
- [x] 3.3 Write and observe failing web tests for the task module: opening it asks for the
  names once, switching between the board and the calendar asks for nothing, opening a card
  asks for nothing, and leaving the module drops the store.
- [x] 3.4 Mount the sync in `TasksPage`, read the store in `TaskBoard`, `TaskCalendar`,
  `TaskFormDialog` and `TaskPreviewDialog`, and delete the `useQueries` block from both
  widgets.
- [x] 3.5 Write and observe failing web tests for switching between the board and the
  calendar: no task listing is asked for, no project list, no campaign names, and the
  realtime connection is the one that was already open.
- [x] 3.6 Lift `useTasks` and `useTaskEvents` into `TasksPage` and pass the tasks into both
  widgets.
- [x] 3.7 Run the web production build, then `npm test` and `npm run test:web` until both are
  green.

## 4. Close the change

- [x] 4.1 Run `openspec validate load-task-references-once --strict` and confirm the
  implementation matches every scenario in the delta spec.
- [x] 4.2 Update `README.md` where it describes how the web app holds server data.
