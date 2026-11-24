## 1. API: the lead on the event and the section rules

- [x] 1.1 Add `leadId` to `AuditEvent` in `prisma/models/audit.prisma`, to `StoredAuditEvent`, to `AuditEventInput` and to the audit writer; generate the migration with `--create-only`, append the column-grant backfill described in design.md, and apply it to the dev and test databases
- [x] 1.2 Extend `sectionToWhere` to the task, CRM and people lists and the `leadId` rule from design.md; add `leadId` to the event schema in `audit-openapi.ts` and describe `section` in the list operation
- [x] 1.3 Set `leadId` on every task event from `task.leadId`, and on lead events and lead file events from the lead's id
- [x] 1.4 Tests: extend the working-tree split test in `audit.api.test.ts` with a task of a lead, a `lead-note`, a `task-comment` with and without a lead, an `invite` and a presence event; `section=people` answers 400; a task created for a lead through the API carries `leadId` and lands in `crm`; a lead file event carries the lead; run `npm test` and `npm run test:web`
- [x] 1.5 Add `leadId: null` to the `projects` condition in `sectionToWhere`, and limit the `leadId` branch of the `crm` condition to types outside the people list, as design.md states; extend the split test in `audit.api.test.ts` with a campaign event that carries a lead, which `crm` returns and `projects` does not, and an invite event that carries a lead, which no section returns; run `npm test`

## 2. API: task comments

- [x] 2.1 Give the comment repository a transaction context, and give the comment use cases the unit of work, the audit writer and the task's project context in the composition wiring
- [x] 2.2 Write the `task-comment` events for writing, editing and deleting a comment as design.md lists them, with the task's client, project and lead, without the body, and none for a personal task
- [x] 2.3 Tests: each of the three writes one event without the body; an admin deleting a manager's comment is the event's actor; a refused edit or deletion writes none; a personal task writes none; a comment on a task of a lead lands in `crm` and one on a plain task in `tasks`; run `npm test` and `npm run test:web`

## 3. API: task files

- [x] 3.1 Name the newly attached documents and images in the task's create and update events as `documentsAdded` and `imagesAdded`, counting only what was not attached before
- [x] 3.2 Write `DELETE task-image` and `DELETE task-document` events on removal, with the task's client, project and lead; write none for an upload that is not attached and none for a personal task
- [x] 3.3 Tests: a save that attaches a document names it in the task's event and writes no other event; an update that keeps the same files names none; removing a document or an image writes one deletion event naming the task; an unattached upload and a personal task write none; run `npm test` and `npm run test:web`

## 4. API: lead notes

- [x] 4.1 Return the lead's name from `leadOnBoard`; give the note repository a transaction context and the note use cases the unit of work and the audit writer
- [x] 4.2 Write the `lead-note` events for writing, editing and deleting a note as design.md lists them, with the lead's client, project and id, without the body
- [x] 4.3 Tests: each of the three writes one event in `crm` without the body; a refused edit or deletion writes none; the lead panel's own history does not list note events; run `npm test` and `npm run test:web`

## 5. API: member removal and invitation revocation

- [x] 5.1 Give the member use cases the audit writer; write the `DELETE member` event in the removal transaction, with the name and role read before the row is deleted and no client or project
- [x] 5.2 Give the invite use cases the audit writer; write the `DELETE invite` event in the revocation transaction, with the email, role, registration type and the invitation's client
- [x] 5.3 Tests: an admin's removal of a manager is read by an admin and not by a manager; a refused removal of the last admin writes none; a client's principal revoking an invitation to their client reads the event; revoking a used invitation answers 409 and writes none; both events belong to no section; run `npm test` and `npm run test:web`

## 6. API: counts on deletion

- [x] 6.1 Add `dependents(context, id)` to the client, project, lead and task repository ports and their Prisma adapters, counting the kinds in the table in design.md
- [x] 6.2 Call it in the four delete use cases inside the delete transaction and before the delete, and put the non-zero counts into the event's `changes.removedWith`; the lead's event keeps `before`
- [x] 6.3 Tests: a project with tasks, leads and a task of a lead counts them and writes no event for them; a client counts across its projects plus companies and people; a lead counts its tasks, notes and files; a task counts comments and its images and documents together; a task with nothing under it carries no `removedWith`; run `npm test` and `npm run test:web`

## 7. Web: tabs and a project choice per tab

- [x] 7.1 Add `leadId` to the web `AuditEvent` type; replace the shared `projectId` in `ActivitySections` with one value per type tab, each starting at Все проекты
- [x] 7.2 Tests: make the mock's `sectionOf` in `ActivityLogModal.test.tsx` mirror the server lists and `leadId`; each type tab keeps its own project across tab switches; CRM lists lead events and a task of a lead, and Задачи does not list that task; a member removal shows only on Сотрудники; a company shows under Все проекты and not under a project; run `npm run test:web` and `npm test`

## 8. Web: readings and the counts line

- [x] 8.1 Add readings in `describe.ts`, with Russian and English copy in `ru.ts` and `en.ts`, for: `Reset the second factor of N`; `Created a share link for project “P”`, `Replaced the share link of project “P”`, `Switched off the share link of project “P”`; `Connected Google Ads account`, `Renewed Google Ads sign-in`, `Disconnected Google Ads account`; `Replaced Meta advertising account credentials`; `Connected Search Console site S`, `Renewed Search Console sign-in for S`, `Disconnected Search Console site S`, `Linked Google Analytics property A to S`, `Unlinked Google Analytics from S`; `Created a website key for project “P”`, `Replaced the website key of project “P”`, `Removed the website key of project “P”`, `Changed the sites allowed to send leads to project “P”`; `Edited the M report`, `Refreshed the M report`, `Entered past months for the M report`; and `Changed the summary of project “P” for C account A`
- [x] 8.2 Add subjects for `task-comment`, `task-image`, `task-document`, `lead-note`, `member` and `invite`, readings for every summary in the new-events table of design.md, and a detail on task events for `documentsAdded` and `imagesAdded`
- [x] 8.3 Add the `removedWith` reader in `entities/audit-event/model` with plural forms from `Intl.PluralRules`, a heading per deleted kind, and the line under the event in `ChangeItem`; add the copy to `ru.ts` and `en.ts`
- [x] 8.4 Tests: `describe.test.ts` reads every summary of 8.1 and 8.2 in Russian and one of them in English; the history window shows «Вместе с проектом удалено: 12 задач, 30 лидов» under a project deletion and «Вместе с лидом удалено: 1 задача, 2 заметки» under a lead deletion, and no such line without counts; run `npm run test:web` and `npm test`

## 9. Close out

- [x] 9.1 On the dev database after the migration, check that events of existing tasks of leads carry their lead, that lead events carry their own id, and that no other column changed
- [x] 9.2 Run `openspec validate activity-log-sections-and-deletions --strict`, `npm test` and `npm run test:web`
