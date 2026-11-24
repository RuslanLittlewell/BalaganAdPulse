## Context

See proposal.md for the motivation. The working tree already holds a first pass: `AUDIT_SECTIONS = ["projects", "tasks", "crm"]`, an optional `section` query on `GET /api/audit`, and `sectionToWhere` in `prisma-audit-repository.ts`, which sorts events by `entityType` alone (`task` to tasks; `lead`, `lead-column`, `lead-field`, `crm-company`, `crm-person` to CRM; everything except those and `member` to projects). The web shows four tabs that share one `projectId` state and sends `section` instead of `inProject=true`.

Three facts shape the rest:

- A task of a lead writes the same events as any task, `entityType: "task"`, with nothing on the event that names the lead (`task-use-cases.ts`). Sorting by type alone puts tasks of leads in Задачи.
- `audit_event` is append-only: the first audit migration revokes `UPDATE` and `DELETE` from the role, and its context columns (`client_id`, `project_id`, `campaign_id`) have no foreign keys, so an event outlives what it describes.
- Task comments, lead notes, member removal and invite revocation run outside the audit writer today, and the comment and note repositories write outside a transaction.

## Goals / Non-Goals

**Goals:**
- Decide an event's section on the server from what the event already carries plus the lead it concerns.
- Write every new event through the existing audit writer, in the transaction of the change it describes.
- Give every summary the API writes a reading in `describe.ts`.

**Non-Goals:**
- A `leadId` filter on `GET /api/audit`. The column serves the section rule only.
- Converting lead file events. They stay `UPDATE lead` with `fileAdded` and `fileRemoved`; they already read well and already land in CRM, and the lead panel's own history reads them by `entityType: "lead"`.
- Counting rows below the listed kinds: checklist items, participants, KPIs, integrations, notifications, the comments of tasks deleted with a project.
- Removing `inProject` from the API. The web stops sending it; it stays documented for other callers.

## Decisions

### The lead is context on the event: a nullable `lead_id` column

`AuditEvent` gains `leadId String? @map("lead_id")`, without a foreign key and without an index, like the other context columns. `AuditEventInput` and `StoredAuditEvent` gain `leadId`, and the writer stores `null` when it is absent. Events set it as follows:

- task events (create, update, move, complete, delete): `task.leadId`;
- comment, image and document events: the lead of their task;
- lead events, lead file events and lead note events: the lead's id;
- every other event, lead columns, lead fields, companies and people included: `null`.

Alternatives considered:
- A distinct `entityType: "lead-task"`. Rejected: comments, images and documents of a lead task would need their own types too, and each would need a second reading on the web.
- A stored `section` column. Rejected: it writes a screen's grouping into history, so moving a type to another tab later means rewriting events.
- A join to `task` at read time. Rejected: the audit table has no relation to tasks, and the join finds nothing once the task is deleted, which is exactly when the deletion event must land in CRM.

### Section rules live in the audit repository

`sectionToWhere` in the working tree stays and grows to these lists:

| List | Entity types |
| --- | --- |
| task types | `task`, `task-comment`, `task-image`, `task-document` |
| CRM types | `lead`, `lead-column`, `lead-field`, `lead-note`, `crm-company`, `crm-person` |
| people types | `member`, `invite` |

- `tasks`: type among task types and `leadId` null.
- `crm`: type among CRM types, or `leadId` not null and type outside the people list. No writer sets a lead on a member or invite event today; the condition on the people list keeps such an event in no section if one ever does.
- `projects`: type in none of the three lists and `leadId` null. No writer sets a lead on an event of another type today; the `leadId` condition keeps such an event out of `projects` if one ever does, so it lands in `crm` alone.
- no `section`: no condition, which is what Сотрудники sends.

`AUDIT_SECTIONS` stays `projects | tasks | crm`; Zod already answers 400 to any other value. The section condition is ANDed with the read scope and the other filters, as in the working tree, so the scope rules in `scopeToWhere` do not change. Presence events and second-factor resets already use `entityType: "member"`, so they fall into people types without a change to their writers.

### New events and their summaries

Summaries keep the existing English form, so the web reads each family with one pattern.

| Change | entityType | entityId | action | summary | changes |
| --- | --- | --- | --- | --- | --- |
| comment written | `task-comment` | comment id | CREATE | `Added a comment to task “T”` | `{ taskId }` |
| comment edited | `task-comment` | comment id | UPDATE | `Edited a comment on task “T”` | `{ taskId }` |
| comment deleted | `task-comment` | comment id | DELETE | `Deleted a comment on task “T”` | `{ taskId }` |
| image removed | `task-image` | image id | DELETE | `Removed an image from task “T”` | `{ taskId }` |
| document removed | `task-document` | document id | DELETE | `Removed document “D” from task “T”` | `{ taskId, name }` |
| note written | `lead-note` | note id | CREATE | `Added a note to lead “L”` | none |
| note edited | `lead-note` | note id | UPDATE | `Edited a note on lead “L”` | none |
| note deleted | `lead-note` | note id | DELETE | `Deleted a note on lead “L”` | none |
| member removed | `member` | membership id | DELETE | `Removed N from the organization` | `{ before: { name, role } }` |
| invitation revoked | `invite` | invite id | DELETE | `Revoked the invitation for E`, or `Revoked an invitation` without an email | `{ before: { email, role, registrationType } }` |

Comment, image and document events take the client and project the way task events do, through the project context of the task, and are skipped for a personal task, as task events are. Note events take `clientId` and `projectId` from the lead; `leadOnBoard` returns the lead's name as well, for the summary. The comment and note repositories take a transaction context, and their use cases receive the unit of work and the audit writer in the composition wiring.

A removed member's name and role are read before the membership row is deleted. The removal event carries no client or project: a membership belongs to the organization and may hold grants on several clients, so no single client owns the event. This matches the second-factor reset. A revoked invitation carries the invitation's `clientId`, which is null for staff invitations.

### Comment and note text stays out of the trail

Events name the task or lead and never copy the body. A deleted comment then stays deleted, the trail holds no second copy of every conversation, and a comment event shows a reader nothing beyond the task title that the task's own events already show. Alternative: store the body or its first line. Rejected for those three reasons.

### Attached files are named in the task's own event

Images and documents are uploaded unattached and claimed by the task's create or update, inside that transaction. The task's event gains `changes.documentsAdded: [{ id, name }]` and `changes.imagesAdded: [id]`, each present only when non-empty, computed as the ids claimed now minus those attached before. The summary stays `Created task “T”` or `Updated task “T”`. One action stays one event, as the audit-trail spec asks. Alternative: a `CREATE task-document` event per file beside the task's event. Rejected as two events for one save.

Removal is its own request, so it writes its own `DELETE` event under its own entity type and reads as Удаление. Recording it as `UPDATE task`, the way lead files are recorded, was rejected because the history would label a deletion as a change.

### Cascade counts go into `changes.removedWith`

Each deleting use case asks its repository for `dependents(context, id)` inside the delete transaction, before the delete, and puts the non-zero counts into the event's changes as `removedWith`. All zero means no `removedWith` key. The adapters count with Prisma directly:

| Deleted | Kinds and where they are counted |
| --- | --- |
| client | `projects`, `companies` (`Company`), `persons` (`Person`) by `clientId`; `campaigns`, `leads`, `tasks`, `reports` (`MonthlyReport`), `documents` (`ProjectDocument`) through `project.clientId` |
| project | `campaigns`, `leads`, `tasks`, `reports`, `documents` by `projectId` |
| lead | `tasks` by `leadId`, `notes` (`LeadNote`), `files` (`LeadFile`) |
| task | `comments` (`TaskComment`), `files` (`TaskImage` plus `TaskDocument`) by `taskId` |

The lead's event changes become `{ before, removedWith }`. Client, project and task deletions, which carry no changes today, carry `{ removedWith }` or nothing. Tasks of leads count among a project's tasks because they carry the project. A personal task writes no event, so it counts nothing.

Alternatives considered: a database trigger that counts. Rejected, because it hides product behaviour in SQL. A count through each owning module's ports. Rejected, because a client deletion would call five modules for numbers one adapter reads in one round trip.

### Web: a project choice per type tab, readings, the counts line

- `ActivitySections` replaces the single `projectId` with one value per type tab, `Record<"projects" | "tasks" | "crm", string>`, each starting at Все проекты. The person choice stays as it is.
- `AuditEvent` gains `leadId: string | null`.
- `describe.ts` gains subjects for `task-comment`, `task-image`, `task-document`, `lead-note`, `member` and `invite`, a reading per new summary, a reading per raw English summary listed in tasks.md, a detail for `documentsAdded` and `imagesAdded` on task events, and a summary-tile pattern that accepts the `for CHANNEL account ID` suffix.
- A `removedWith` reader in `entities/audit-event/model` turns the counts into «Вместе с проектом удалено: 12 задач, 30 лидов». The heading comes from `activity.removedWith.<entityType>`, and each kind's word from `activity.removedWith.<kind>.<category>`, where the category comes from `Intl.PluralRules` of the current locale. `ChangeItem` shows the line under the event. The colon keeps the line correct for «1 задача», which «удалено 1 задача» would not be.
- The test mock's `sectionOf` mirrors the server lists and `leadId`, so the tab tests exercise the same rule.

### Relation to `crm-lead-tasks-and-notes`

That change's design says notes are not audited and the activity tab keeps listing lead changes only. This change reverses the first point. The second still holds for the lead panel's own history: note events use `entityType: "lead-note"`, and the panel reads `entityType: "lead"` only. No spec of that change is modified, so either change can be archived first. Its notes model, routes and use cases are already in the code.

## Risks / Trade-offs

- [The backfill writes to an append-only table] → The migration grants `UPDATE` on the `lead_id` column only, fills it and revokes the grant in the same file. No recorded value changes, and the API still offers no way to write an event.
- [Events of lead tasks deleted before this change keep `leadId` null and stay in Задачи] → Accepted. Lead tasks shipped recently, so few such events exist.
- [A row inserted between the count and the delete is counted wrong] → Both run in one transaction, one statement apart. The count is informational, so an error of one in a race is accepted.
- [Comments are frequent, so Задачи and CRM fill faster] → Paging is unchanged; the window loads further events on demand.
- [The `crm` condition ORs on `lead_id`] → The query still runs inside one organization in date order, served by the `(org_id, created_at)` index. If production volume makes it slow, add an index on `(org_id, lead_id, created_at)` without changing behaviour.
- [A client's principal who removes one of their people does not see the event] → Accepted, as with second-factor resets: member events reach only readers of the whole organization.
- [Companies, people and tasks without a project disappear when a project is chosen] → Kept as today and listed in the proposal for the user to confirm.

## Migration Plan

1. Add `leadId` to `AuditEvent` in `prisma/models/audit.prisma` and generate the migration with `prisma migrate dev --create-only`.
2. Append the backfill to the generated SQL, in this order: grant `UPDATE ("lead_id")` on `audit_event` to `CURRENT_USER`; set `lead_id = entity_id` where `entity_type = 'lead'`; set `lead_id` from `task.lead_id` where `entity_type = 'task'`, `entity_id` is a task's id and that task has a lead; revoke the column grant.
3. Apply it to the dev and test databases and run `npm test`.

Existing data survives. The migration adds a nullable column and fills it for events whose lead can still be found; no event is deleted and no other column changes. Rollback drops the column: tasks of leads then fall back into Задачи by type, and the new event types stay readable through their summaries. The API and the web ship together, since one process serves both.
