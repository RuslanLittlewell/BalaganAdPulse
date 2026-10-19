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

## 3. More kinds in the API

- [x] 3.1 Add TASK_UPDATED, DOCUMENT_ADDED and TASK_DUE_SOON, `notification.document_id` and `task.due_soon_for`, with a second migration; add `TASK_TIME_ZONE` to the config
- [x] 3.2 Report task changes through `TaskNotices.changed` (update, move to another column, completion) and new documents through `DocumentEvents.created`; add the notifier's `taskChanged`, with the refresh of an unread one, and `documentAdded`
- [x] 3.3 Add the deadline arithmetic, `DueTasks` and its Prisma adapter, `remindDueTasks` and the due-soon worker; start and stop it with the server; return the document and the task's due date and time in the list and its OpenAPI
- [x] 3.4 Cover it: who is told of a change and the refresh; a new document's recipients; deadlines with and without a time and across the zone; the 24-hour window; once per deadline and again for a new one; done, archived and module-less tasks; nobody named; the worker; `npm test` green

## 4. More kinds in the web app

- [x] 4.1 Add the kinds, the document and the due fields to the web types; move a refreshed notification to the top without counting it twice
- [x] 4.2 Write the new texts and the deadline line in the list; open a document notification on its document; add the copy to `ru.ts`
- [x] 4.3 Cover it: the texts, the deadline line, opening a document, a refreshed notification on the stream; `npm run test:web` green
- [x] 4.4 Describe the new kinds and `TASK_TIME_ZONE` in README.md; `openspec validate notifications --strict`

## 5. The notification sound

- [x] 5.1 Add `notification.wav` to `shared/assets` and `soundNotification` to `entities/notification`, played by the stream hook for each arriving notification, once across tabs
- [x] 5.2 Cover it: a visible tab plays at once, a hidden one after its delay, a claimed key stays silent, a refreshed notification sounds again, a refused play changes nothing, a list fetch plays nothing; `npm run test:web` green
- [x] 5.3 Mention the sound in README.md; `openspec validate notifications --strict`
