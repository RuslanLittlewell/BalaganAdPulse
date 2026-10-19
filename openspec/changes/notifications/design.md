## Context

The API is hexagonal: each module keeps domain, application, infrastructure and presentation
apart, other modules are reached through their `index.ts`, and adapters are built only in
`composition`. Live updates already flow over one WebSocket at `/api/realtime`
(`modules/realtime`), authenticated by the access cookie, carrying task, lead and presence events
to an in-memory registry of connections. Task events are published after the use case commits,
detached (`runDetached`). The web authenticates with cookies (`credentials: "include"`) and
renews them through `ensureFreshToken` and `forceRefresh`.

A project's KPI progress is computed only on the web (`kpiProgress`, `targetForRange` in
`entities/kpi`; the marker's zones in `projectTone`). Metrics change only when a Meta import
finishes (`PrismaImportJobs.complete`), and a project KPI only through `kpi-use-cases`.

## Goals / Non-Goals

**Goals:**
- Notifications that survive a reload and reach open tabs immediately.
- The same "green" as the project list, decided on the server.

**Non-Goals:**
- Email or push notifications, per-kind preferences, muting.
- Retention: notifications are kept; the list shows the latest 50.
- Notifying a repeating task's next occurrence; it is not a new assignment.

## Decisions

**A `notifications` module owns storage, recipients and delivery.** Its use cases are
`projectCreated(project, actor)`, `participantsNamed(task, memberIds, actor)` and
`projectKpiChanged(projectId, actor | null)`, plus `list`, `read`, `readAll` and `subscribe`
for the member. Other modules call it through ports of their own — `ProjectEvents` in
`projects`, `TaskAssignments` in `tasks`, `ProjectKpiEvents` in `kpi`, an `onImported`
callback in the import worker — wired in `composition`, so no module imports another's
application code. Each port is called after its transaction commits and runs detached: a
failure to notify is logged and never fails the request or the import. The cost is that a crash
between commit and notification loses that notification; nothing else is affected.

**Recipients are found in one query per event.** For KPI_MET and PROJECT_CREATED, the adapter
selects active memberships of the project's organization whose role is ADMIN, or MANAGER or GUEST
with client-wide or project access to it — the rule `reachableProjects` applies — then drops the
actor. For TASK_ASSIGNED the tasks use case passes the participants added: all of them on create,
the new ones minus the previous ones on update. The notifier keeps active members other than the
actor, and customers only when the task is shown to the client, matching who sees the task on the
board.

**KPI progress moves into `modules/kpi/domain/progress.ts`.** It ports `targetForRange` and
`kpiProgress` from the web, keeping their arithmetic: monthly metrics prorated day by day, ratios
as they are, lower-is-better as target over actual, a manual KPI as value over target, an
unmeasured figure as no percent. Green is the rounded percent at or above 100, as `projectTone`
decides it. The month runs from the first of the UTC month to today in UTC; the web uses the
browser's day, so near midnight the two can differ by a day, which only moves the moment of the
notification. The figures come from a notifications adapter that sums the project's
`campaign_daily_metric` rows for the range and derives ratios with `performanceOf` from
`modules/campaigns`.

**Once a month is claimed on the project row.** `project.kpi_met_month` (a date, the first of the
month) is set with a conditional update, `WHERE kpi_met_month IS DISTINCT FROM <month>`; only the
caller whose update touched a row creates the notifications. An import and a KPI edit racing for
the same project therefore notify once. A separate table was rejected: the claim is one fact per
project and dies with it.

**Notifications reference live rows.** `notification` holds `recipient_id`, `kind`, nullable
`project_id`, `task_id` and `actor_id`, `read_at` and `created_at`. Project and task cascade on
delete, the recipient too, the actor sets null. The list joins the current project name, task
title and actor name, so a rename shows its new name. An index on `(recipient_id, created_at)`
serves the list; the unread count reads the same rows filtered by `read_at IS NULL`.

**Server-Sent Events, beside the WebSocket.** The stream is the transport asked for. It is
one-way, rides plain HTTP through the existing authentication and actor-resolution middleware,
and the browser reconnects it by itself. It is a second long-lived connection per tab beside the
WebSocket. Moving tasks and leads onto it is out of scope.

The handler answers `200` with `Content-Type: text/event-stream`, `Cache-Control: no-cache,
no-transform` and `X-Accel-Buffering: no` (nginx would otherwise buffer it), writes `retry: 5000`
and a `ready` event, registers a listener for the membership in an in-memory hub, writes each
notification as `event: notification`, and a `: keepalive` comment every 25 seconds, inside
nginx's 75-second `proxy_read_timeout`. Closing the request removes the listener. The hub lives
in the process, like the WebSocket registry: one API process serves production. Shutdown ends
every stream before the server closes, since an open stream would hold `server.close` forever.

**The web keeps the list in React Query and patches it from the stream.**
`entities/notification` holds the API, `useNotifications` (key `["notifications"]`), the read
mutations and `useNotificationStream`. The stream hook opens an `EventSource` after
`ensureFreshToken`; a `notification` event prepends the item and raises the unread count in the
cache; every `open` after the first refetches the list, since events may have been missed. When
the browser gives up (`readyState` CLOSED, as on a 401), the hook calls `forceRefresh` and reopens
with a backoff from 1 to 15 seconds. It is mounted once, in the header.

**The bell is a widget.** `widgets/notification-center` renders the bell button, its dot and a
popover with the list, using the vendored `popover`. Choosing an item calls the read mutation and
navigates: a project to `projectPath(id)`, a task to `/tasks?task=<id>`. The tasks page opens the
task named by `task` once the tasks are loaded, then drops the parameter.

## Migration Plan

One migration creates the `notification_kind` enum and the `notification` table with its foreign
keys and index, and adds the nullable `kpi_met_month` date to `project`. Nothing is backfilled and
existing data survives. Rolling back drops the table, the enum and the column; notifications are
lost, nothing else is.

## Risks / Trade-offs

- [A notification lost when the process dies between commit and delivery] → the event itself is
  committed and visible elsewhere; notifications are a convenience, not a record.
- [Several API processes would split the hub] → production runs one; moving to Postgres
  `LISTEN/NOTIFY` would be the step, and the WebSocket registry shares the limit.
- [The KPI arithmetic now lives twice, web and API] → the API's tests use the web's cases, and the
  spec fixes the rule.
- [Over HTTP/1.1 a browser opens at most six connections per host, and every tab now holds a
  stream] → many tabs on HTTP/1.1 could starve requests; serving the site over HTTP/2 at the TLS
  proxy removes the limit.
- [The table grows without bound] → indexed by recipient and time; a retention job can follow.
