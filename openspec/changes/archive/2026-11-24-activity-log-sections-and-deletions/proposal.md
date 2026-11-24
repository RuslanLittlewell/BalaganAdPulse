## Why

The history window misses some deletions and reads others poorly. Deleting a task comment, a task image or document, or a lead note, removing a member from the organization and revoking an invitation leave no event at all. Deleting a client, a project, a lead or a task removes everything under it, and the history does not say how much went with it. Several events the window does show come out as raw English text. All project work also shares one Проекты tab, so a manager who wants to see what happened to tasks or in the CRM scrolls past everything else.

## What Changes

- The history window has four tabs: Проекты, Задачи, CRM and Сотрудники. Each event goes to the tab of its type. Tasks of leads, their comments and files, lead notes and lead files go to CRM.
- Проекты, Задачи and CRM each keep their own project choice. Сотрудники keeps its person choice and still lists every event.
- Removing a member, revoking an invitation, resetting a member's second factor, and coming online or going offline show only on Сотрудники.
- `GET /api/audit` accepts `section=projects|tasks|crm`. An event carries the lead it concerns, so the API can place tasks of leads and their comments and files in CRM.
- The API starts recording task comments, task images and documents, lead notes, member removal and invitation revocation. Comments and notes are recorded when they are written, edited and deleted. A task file is recorded when it is attached to a task and when it is removed.
- Deleting a client, a project, a lead or a task stays one event. That event now counts what the database removed with it, and the window shows the counts: «Вместе с проектом удалено: 12 задач, 30 лидов».
- Every summary the API records gets a Russian and an English reading. This covers the share link, Google Ads, Meta credentials, Search Console and Google Analytics, the website key, report edits, refreshes and past months, summary tiles of one account, second-factor resets, and every new event above.
- The working tree already holds the first part of this work: the `section` filter by entity type, the four tabs with one shared project choice, and readings for lead fields, companies and people. This change keeps that work and completes it.

Out of scope:

- Removing the Bitrix24 connection, unlinking Telegram, turning off one's own second factor, trusted second-factor addresses, personal tasks and personal project groups stay unrecorded.
- Who may read which events does not change. A manager with a grant on one project still loses that project's events once the project is deleted, and a client's deletion stays visible to admins only.

## Open for review

- Companies and people of the CRM, and tasks that have no project, carry no project. They show under Все проекты and drop out when a project is chosen. This keeps today's behaviour. The user may confirm it or ask for another rule.
- Events of tasks of leads recorded before this change carry no lead. The migration fills the lead in for every such task that still exists. Events of lead tasks that were already deleted stay in Задачи.
- Comment and note events do not copy the text. A deleted comment stays deleted, and the history says who deleted it and from which task.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `activity-log`: four tabs by event type, each type tab with its own project choice; counts shown under a deletion; a reading for every summary the API records.
- `audit-trail`: the `section` filter and the lead on each event; events for task comments, task files, lead notes, member removal and invitation revocation; counts on the deletion of a client, a project, a lead or a task.

## Impact

- API, audit module: a nullable `lead_id` column on `audit_event` with one Prisma migration that also fills it for existing events, the section rules, the OpenAPI document of the event.
- API, tasks module: comment, image and document use cases get the audit writer and a transaction; task events carry the task's lead and name the files attached.
- API, leads module: note use cases are audited; lead events carry the lead; deleting a lead counts its tasks, notes and files.
- API, clients and projects modules: deleting a client or a project counts what goes with it.
- API, members and invites modules: removal and revocation write events.
- Web: `entities/audit-event` (event type, readings), `widgets/activity-log-modal` (project choice per tab, the counts line), `ru.ts` and `en.ts`.
- The active change `crm-lead-tasks-and-notes` says in its design that notes are not audited. This change reverses that decision. It modifies none of that change's specs, so the two can be archived in either order.
- API clients keep working: `section` and `leadId` are additions, and `inProject` stays.
