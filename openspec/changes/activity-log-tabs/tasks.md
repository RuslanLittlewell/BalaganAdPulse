## 1. The API

- [x] 1.1 Add `ONLINE` and `OFFLINE` to `audit_action` with the migration and the domain type; let the audit writer take `occurredAt`
- [x] 1.2 Return the last-seen moment from the presence sweep and pass the moment of each arrival and departure to the announcements; record them as audit events in `composition`
- [x] 1.3 Add `inProject` to the audit filters and `GET /api/audit/actors` with the reader, the repository query and OpenAPI
- [x] 1.4 Cover it: the events of an arrival, a lapse dated at the last request and a sign-out; managers do not read them; `inProject`; the actors of an admin and of a manager, deleted members left out; `npm test` green

## 2. The window

- [x] 2.1 Add the actions, `inProject` and `useAuditActors` to `entities/audit-event`
- [x] 2.2 Rebuild the window with the **Проекты** and **Сотрудники** tabs and their selects, compact presence rows and exact times; add the copy to `ru.ts`
- [x] 2.3 Cover it: the tabs, each select narrowing the list, the choice kept across tabs, presence rows; `npm run test:web` green
- [x] 2.4 Describe it in README.md; `openspec validate activity-log-tabs --strict`

## 3. A readable list

- [x] 3.1 Add `describeAuditEvent` reading the API's summaries in Russian, with the copy in `ru.ts`
- [x] 3.2 Rebuild the list as a timeline grouped by day, with the action colour tokens for both themes, the time of day and how long ago on hover
- [x] 3.3 Cover it: every summary template and the fallback, the day labels across a year, the timeline in the window; `npm run test:web` green
