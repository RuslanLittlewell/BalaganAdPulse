## Why

Things that concern a member happen while they look elsewhere: a project reaches its KPI
during an overnight import, a colleague adds a project, someone names them on a task. Today
they learn of it only by stumbling on the project list or the task board. The app needs
one place that tells each member what happened to them, the moment it happens.

## What Changes

- Members receive notifications, kept per member, of three kinds:
  - **KPI выполнен** — a project's marker turns green for the current month, at most once per
    project per month, told to the agency's people who reach the project.
  - **Новый проект** — a project is added, told to the agency's people who reach it, except
    the one who added it.
  - **Новая задача** — a member is named a participant of a task, on creation or later,
    unless they named themselves.
  - **Задача изменена** — someone else edits a task the member is on, moves it to another
    column or completes a repeating one; further changes refresh an unread notification
    rather than pile up.
  - **Новый документ** — a document is added to a project, told to the agency's people who
    reach it, except the one who added it.
  - **Подходит срок** — a task's deadline is less than a day away, once per deadline, told to
    its participants, or to its creator when it names nobody.
- A bell, first among the app header's icons before Contacts and History, opens the list of
  the latest notifications. A dot on the bell shows while any is unread. Choosing a
  notification marks it read and opens its project or task; **Прочитать все** marks them all
  read.
- New notifications reach open tabs at once over Server-Sent Events, on a stream of their
  own beside the existing WebSocket channel, and play a short sound once, whatever the number
  of open tabs.
- The tasks page opens the task named in its address, so a notification can link to it.
- API: `GET /api/notifications`, `POST /api/notifications/:id/read`,
  `POST /api/notifications/read-all`, and the event stream `GET /api/notifications/stream`.

## Capabilities

### New Capabilities

- `notifications`: what a member is notified of and who receives it, the bell and its list,
  reading, and live delivery over Server-Sent Events.

### Modified Capabilities

None.

## Impact

- Prisma: a `notification` table and a `notification_kind` enum; `project` gains
  `kpi_met_month` and `task` gains `due_soon_for`. Existing data is untouched.
- Configuration: `TASK_TIME_ZONE`, the time zone deadlines are read in, `Europe/Minsk` when
  unset.
- API: a new `modules/notifications` (domain, use cases, Prisma adapters, HTTP and the SSE
  stream, OpenAPI); a project-progress function in `modules/kpi`; ports in
  `modules/projects`, `modules/tasks`, `modules/kpi`, `modules/project-documents` and
  `modules/integrations` that report a created project, named participants, a changed task, a
  changed project KPI, a new document and a finished import; a worker that looks for
  deadlines drawing near; wiring in `composition`; shutdown ends open streams and stops the
  worker.
- Web: `entities/notification` (API, queries, the stream), a bell widget in the app header
  linking to projects, documents and tasks, the tasks page reading `?task=`, copy in `ru.ts`.
- Deployment: none. The stream sets `X-Accel-Buffering: no` and sends a heartbeat inside
  nginx's 75-second read timeout.
