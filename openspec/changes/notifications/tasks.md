## 1. Notifications in the API

- [x] 1.1 Add the `notification` table, the `notification_kind` enum and `project.kpi_met_month`, with the migration
- [x] 1.2 Add `modules/kpi/domain/progress.ts` (prorated target, percent, green) and cover it with the web's cases
- [x] 1.3 Build `modules/notifications`: domain, the hub, the use cases (list, read, read-all, subscribe, project created, participants named, project KPI changed), the Prisma adapters (notifications, recipients, month figures, the monthly claim), the HTTP router, the SSE stream and its OpenAPI
- [x] 1.4 Report events from `projects` (created), `tasks` (participants named on create and update), `kpi` (project KPI set) and the import worker (import finished); wire them in `composition`, mount `/api/notifications`, end streams on shutdown
- [x] 1.5 Cover it: list, read, read-all and 404; recipients of a new project; a task's named participants on create and update, self and hidden-task clients left out; KPI met by a manual KPI and by imported figures, once a month, the actor left out; the stream's ready event, a delivered notification, someone else's withheld, 401; `npm test` green

## 2. The bell in the web app

- [x] 2.1 Add `entities/notification`: types, API, `useNotifications`, the read mutations, `useNotificationStream`
- [x] 2.2 Add `widgets/notification-center` with the bell, its dot and the list; place it first in the header, before Contacts and History, a separator between each icon; add the copy to `ru.ts`
- [x] 2.3 Open the task named by `?task=` on the tasks page
- [x] 2.4 Cover it: the dot, the list texts, reading one and opening its project or task, reading all, the empty list, a streamed notification, reconnecting refreshes the list, the tasks page opening `?task=`; `npm run test:web` and `npm test` green
- [x] 2.5 Describe notifications in README.md; `openspec validate notifications --strict`
