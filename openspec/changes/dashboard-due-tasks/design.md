## Context

See proposal.md for the motivation and specs/dashboard-due-tasks/spec.md for the behavior.

`ImportantInfo` in `widgets/agency-overview` shows the projects without a KPI and receives them as a prop from `KpiOverview`. The tasks screen reads `useTasks()`, which returns every task the viewer may see, and keeps it live with `useTaskEvents`. A task's `dueDate` and `dueTime` are stored in the time zone it was created in, and `localTask` converts them for the viewer. Completing a repeating task moves its `dueDate` to the next occurrence, so `dueDate` is always the next one to do. The tasks page opens a task from the `task` search parameter. Navigation hides modules the organization lacks, using `useAuth().modules`.

## Goals / Non-Goals

**Goals:**
- List what is due soon from the data the web already has.
- Put the rule that decides it in the task entity, where it can be tested without rendering.

**Non-Goals:**
- Changing the API or adding a due-tasks endpoint.
- Completing or rescheduling a task from the dashboard.
- Showing other members' tasks, or a switch between mine and all.
- Reminders and notifications for due tasks.

## Decisions

### A pure rule in the task entity, reading the existing list

`entities/task/lib/due.ts` exports `dueSoon(tasks, userId, now, timeZone)`. It keeps the tasks that meet the spec's conditions after converting each one with `inZone`, and returns them in the spec's order with a `when` of overdue, today, tomorrow or soon and the local day. Today is the viewer's calendar day from `now`. The horizon of two days is a named constant.

Alternative: a server endpoint filtered by date. It would save sending finished tasks to the dashboard, but the tasks screen already loads the same list and the query cache serves both, so the endpoint would add a second source of truth for one small rule.

### One hook, live and gated

`useDueTasks()` in `widgets/agency-overview` combines `useTasks()`, `useTaskEvents()`, `useAuth` for the viewer id and `useNow` so the list changes at midnight. It lives in the widget because the task entity may not import the auth feature. `DueTasks` renders the block only when `useAuth().modules` has the tasks module, so with the module off nothing is requested and no socket opens.

### Where it sits

`DueTasks` is a card of its own with the same frame as the other dashboard cards. `KpiOverview` renders it right after `ImportantInfo`, and `ChannelPanel` follows in the page, so the order is the KPI gauge, Важная информация, the due tasks and the sources. `ImportantInfo` is unchanged. The dashboard grid has four columns from the `xl` breakpoint when the tasks module is on and three when it is off, so no column stays empty. Below `xl` the cards wrap into two columns as before.

### Labels

Labels use the same Russian copy mechanism as the rest of the app, through `t`. Dates use the existing `formatDay`. The row is a `Link` to `ROUTES.tasks` with `?task=<id>`, so the tasks page opens it with the machinery it already has.

## Risks / Trade-offs

- [Members see only tasks they participate in, so a manager who assigns work to others sees none of it] → recorded as an assumption in the proposal; a switch can follow if wanted.
- [The dashboard now loads the whole task list] → it is the list the tasks screen already caches, and it is fetched once per session.
- [A task due at midnight changes label at the viewer's midnight, not the task's] → this is the intended reading of "today" for the viewer.
