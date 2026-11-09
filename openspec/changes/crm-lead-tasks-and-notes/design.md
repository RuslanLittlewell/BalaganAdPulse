## Context

`Task` already carries an optional project and goes through `findReachable`, which checks the member's grant on the project. A `Lead` has a required project, so a task that takes its project from its lead inherits the same access rules without a new check. Lead routes live under `/boards/:boardKey/leads/:id/...` and resolve the lead through `leadOf`, which answers 404 for a lead the member cannot reach. Task comments (`TaskComment`) are the model for lead notes. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- Tie a task to a lead with one nullable column, so every existing task rule keeps working.
- Reuse the task dialog, task events and task queries for lead tasks.
- Keep notes independent of tasks and of `Lead.notes`.

**Non-Goals:**
- Notes with images or documents.
- Moving an existing task onto a lead, or off one.
- Board columns for lead tasks. The CRM view and the Задачи layout reuse the week calendar; the lead's panel lists tasks as blocks.
- Telegram bot and notification changes for lead tasks beyond what tasks already do.

## Decisions

**A nullable `leadId` on `Task`, cascade on delete.** The foreign key points to `Lead` with `onDelete: Cascade`, so deleting a lead deletes its tasks in the database. Index on `leadId`. Alternative: a join table. Rejected, because a task has at most one lead and the join table adds a query for every task read.

**The lead is fixed at creation.** The update schema does not accept `leadId`, and the use case refuses a project change on a task that has a lead. This keeps the rule that a task of a lead lives in the lead's project true without a check on every write. Alternative: allow re-linking. Rejected, since it needs project re-validation and has no requested use.

**The task list excludes lead tasks by default.** Without `leadId` or `scope`, `GET /api/tasks` filters `leadId IS NULL`. `?scope=crm` returns only tasks that have a lead, and `?leadId=<id>` returns the tasks of one lead. Alternative: filter on the client. Rejected, because the board, the calendar and the dashboard due-task counts all read the same list and would each need the filter. One server rule keeps them correct.

**Task responses carry the lead.** `TaskRecord` gains `leadId` and `lead: { id, name, boardKey } | null`, so the CRM view can print the name and link to the board without a second request. The board key is the lead's project id as the existing board routes use it.

**Lead creation goes through the task create path.** `createTask` accepts `leadId`, loads the lead through a new `leads` port (`reachable(actor, leadId)` returning `{ id, projectId, name }`), sets `projectId` from it, forces `visibleToClient` false, and rejects a different `projectId`. The `tasks` module depends on a port, not on the leads module's internals, matching how it already reaches projects and members.

**Notes get their own model and module code inside `leads`.** `LeadNote { id, orgId, leadId, authorId, body, createdAt, editedAt }`, index on `(leadId, createdAt)`, author set null when the member goes. Routes: `GET`, `POST /boards/:boardKey/leads/:id/notes`, `PATCH`, `DELETE .../notes/:noteId`. The use cases mirror `task-comment-use-cases` without mentions. Read needs `read lead`, write needs `update lead`, delete needs author or admin. Each write publishes a lead event so open panels refresh. Alternative: reuse `TaskComment` with a nullable `taskId`. Rejected, because it muddies a model with a cascade tied to tasks.

**Mentions on notes.** `LeadNote.mentionIds` holds the tagged membership ids, as `TaskComment` does. Validation reuses the task module's member lookup (`describe(actor, ids, projectId)`) through a port: a tagged id must be an active member, and a customer must reach the lead's project. Notification uses a new kind `LEAD_MENTIONED` and a nullable `Notification.leadId` (cascade). The notification is visible by the existing rule for project-bound notifications without a task or document, so a member who loses the project stops seeing it. The view carries `lead { id, name, boardKey }`; the bell opens `/crm?board=<boardKey>&lead=<id>&tab=notes`. Telegram text is added beside the task mention. Alternative: a generic notification target. Rejected as a larger refactor of a working model.

**Notes are not audited.** Like task comments, they are conversation, not a state change. The existing activity tab keeps listing lead changes only.

**Web: one task query family, three consumers.** `entities/task` gets `useCrmTasks()` (scope=crm) and `useLeadTasks(leadId)`. Task events invalidate both. `TasksPage` renders `TaskList` for the CRM view with a lead column. The list widget already exists for tasks; it receives the lead name as data, not as a button slot. The task form gets an optional `lead` prop: when the form is opened from the CRM view it shows a required lead picker, when opened from the panel the lead is fixed and the picker is absent.

**Lead picker.** The CRM view needs a lead from any board the member reaches. The picker lists leads through the existing lead queries across the boards the member reaches, searchable by name, grouped by board name. Fetching every board's leads is acceptable at current volumes, since the leads page already loads one board in full. If the member reaches many boards, the picker asks for the board first, then the lead.

**Panel width.** `SidePanel` takes a `width` prop with `default` and `wide`. The lead panel passes `wide`, which sets `md:w-[640px]` with the existing `max-w-full`. Six tab names in Russian fit in 640 pixels at the current tab size. Other panels keep 480. The tab row stays `overflow-x-auto` as a fallback when the panel is clamped by a small window. Alternative: shrink the tab labels. Rejected, since the request asks for a wider panel.

**Layout tabs in the header.** `CrmPage` renders `Tabs` for Канбан, Задачи and Таблица in its header, as `TasksPage` does for its views. `OptionsMenu` loses its Раскладка section and its `layout` props. The layout type becomes `"board" | "tasks" | "table"`. The stored value `calendar` fails `isLayout` and falls back to `board`, so no migration of browser storage is needed. The `crm-calendar` widget and its tests are deleted.

**The Задачи layout reuses the task list.** It renders the same list widget as the task manager's CRM view, with `useCrmTasks` given the board's project id as a filter (`scope=crm&projectId=<board>`). The view bar's search and filters apply on the client: the layout keeps the tasks whose lead id is among the leads that pass the view, so the filter rules are written once. The create form receives the board's leads for its picker.

**A person for every new lead.** `linked` in the lead use cases creates a person named after the lead when the lead has no contact and no contact values, in the same transaction, with the same audit event as other person creates. Meta intake does the same, matching an existing person by the migration's email and phone rules first. The lead event publishes a people change so an open Люди page refreshes. Alternative: show leads inside Люди. Rejected, because Люди lists records of the client, and a lead is not one.

**Period filter.** The `between` operator (shown as в период) joins `on`, `before` and `after` in the filter model. A condition stores two days, `from` and `to`. The condition stays incomplete, and filters nothing, until both are valid and `from <= to`. The date input pair reuses the existing date input of the filter form. Alternative: ready-made month shortcuts. Deferred; the two inputs cover any period.

## Risks / Trade-offs

[Creating a person for every lead fills Люди with name-only people, and duplicates when two leads share a name] → The spec asks for it. Matching by email or phone prevents duplicates where contact values exist. Merging people is out of scope.

[Existing remembered layouts] → Calendar falls back to the board.

[Default exclusion hides lead tasks from a consumer that expected all tasks] → The only consumers are the board, calendar, due-task widget and project task lists, which the spec says must exclude them. The Telegram bot lists the member's tasks. Check it in the implementation and apply the same default.

[A lead task's assignee gets reminders and due-soon notices that link to the task, not the lead] → Notices open the task dialog by task id, which works from every view. The CRM view reads `?task=` the same way the other views do.

[The lead picker loads many leads] → See Decisions, board-first fallback.

[Task cascade silently drops tasks on lead deletion] → The delete-confirm text of a lead is unchanged. Add the task count to the confirmation only if reviewers ask.

## Migration Plan

One Prisma migration adds the `LEAD_MENTIONED` notification kind, `notification.lead_id` and `lead_note.mention_ids`, together with `task.lead_id` (nullable, foreign key to `lead`, cascade, indexed) and creates `lead_note`. Existing rows get `lead_id = NULL`, so all existing tasks stay in the three current views and no data changes. Rollback drops the table and the column; tasks created for leads would lose their link, so roll back only before release. The migration file is generated by Prisma and left as it arrives.
