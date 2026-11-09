## 1. Data model

- [x] 1.1 Add `leadId` and the `lead` relation to `Task` and the `tasks` back-relation to `Lead` in the split Prisma models; add the `LeadNote` model with its relations
- [x] 1.2 Generate the migration and apply it to the dev and test databases; confirm `npm test` stays green

## 2. API: tasks of leads

- [x] 2.1 Add a `leads` port to the tasks module and wire it in `composition/wiring/tasks.ts`
- [x] 2.2 Accept `leadId` on task creation: take the project from the lead, force `visibleToClient` false, refuse a different project; refuse `leadId` changes and project moves on update
- [x] 2.3 Filter the task list: exclude lead tasks by default, `scope=crm` and `leadId` return them; return `leadId` and `lead { id, name, boardKey }` on task records
- [x] 2.4 Apply the default exclusion to the Telegram bot's task lists and the dashboard due-task counts
- [x] 2.5 Update the OpenAPI documents of tasks
- [x] 2.6 Tests: creating, project mismatch, detach refused, unreachable lead 404, cascade on lead deletion, list filters, role rules; run `npm test`

## 3. API: lead notes

- [x] 3.1 Add the note domain, repository port and Prisma repository in the leads module
- [x] 3.2 Add the note use cases: list, add, edit by author, delete by author or admin, with length and blank checks and lead reachability
- [x] 3.3 Add the routes, Zod schemas and OpenAPI entries; publish a lead event on each write
- [x] 3.4 Tests: author and admin rules, blank and too-long bodies, guest read-only, unreachable lead 404, cascade; run `npm test`

## 4. Web: lead tasks

- [x] 4.1 Add task entity queries `useCrmTasks` and `useLeadTasks` and invalidate them from task events and mutations
- [x] 4.2 Add the lead picker and the optional `lead` prop to the task form; require a lead in the CRM view
- [x] 4.3 Add the CRM view to `TasksPage` with the lead column, link to the lead's board, filters and remembered view
- [x] 4.4 Add the Задачи tab to the lead panel with the list, open count and create button
- [x] 4.5 Add the Russian copy to `ru.ts`
- [x] 4.6 Tests for the CRM view, the picker, the panel tab and the guest case; run `npm run test:web`

## 5. Web: lead notes and panel width

- [x] 5.1 Add note API functions and queries in `entities/lead`, refreshed by lead events
- [x] 5.2 Add the Заметки tab with the list, the input, edit and delete for the author
- [x] 5.3 Add the `width` option to `SidePanel`, use `wide` for the lead panel, and order the tabs as the spec says
- [x] 5.4 Tests for the notes tab, the tab order and the guest case, without assertions on styles; run `npm run test:web`

## 6. Web: CRM layouts

- [x] 6.1 Add `projectId` to the CRM task query and filter the list by the board's leads that pass the view
- [x] 6.2 Move the layout choice out of `OptionsMenu` into header tabs of `CrmPage`; change the layout type to board, tasks, table; remember the choice and fall back to board for a stored calendar
- [x] 6.3 Add the Задачи layout with the board's lead picker in the create form and the lead name opening the panel
- [x] 6.4 Delete the `crm-calendar` widget, its tests and its copy; remove the requirement text of `lead-calendar` by archiving
- [x] 6.5 Tests: header tabs for a guest, remembered layout and the calendar fallback, no Раскладка in Настройки, tasks of one board, search by lead; run `npm run test:web`

## 7. API and web: people of new leads

- [x] 7.1 Create a person named after the lead inside lead creation when it has no contact, in the same transaction and with an audit event
- [x] 7.2 Do the same in Meta lead intake, matching an existing person by email then phone first; publish the people event
- [x] 7.3 Tests: name-only lead, chosen contact, imported lead, open Люди refreshing; run `npm test` and `npm run test:web`

## 8. Web: period filter

- [x] 8.1 Add the `between` operator with `from` and `to` to the view state, the catalogue for Дата поступления and Дата, and the filter application
- [x] 8.2 Add the От and До inputs, the chip text, the incomplete and reversed period handling, and the Russian copy
- [x] 8.3 Tests: October period with both ends included, a stage plus a period, a reversed period, an incomplete condition; run `npm run test:web`

## 9. Mentions in notes

- [ ] 9.1 Add `mentionIds` to `LeadNote`, `leadId` to `Notification` and the `LEAD_MENTIONED` kind in one migration
- [ ] 9.2 Validate and store tags in the note use cases; notify the newly tagged through a notification use case `leadMentioned`; show the lead in the notification view
- [ ] 9.3 Add the bell text, the link to the lead's Заметки tab and the Telegram text
- [ ] 9.4 Tests: tagging a colleague, a client's person with and without access, a stranger, self, edit notifies only newcomers, the notification visible only while the project is reachable; run `npm test`
- [ ] 9.5 Add the `@` offer and tag marks to the Заметки tab, make the field one line high with Enter to send, and open the tab from the notification
- [ ] 9.6 Tests for the offer, tag marks, one-line field, and the bell link; run `npm run test:web`

## 10. Calendar form and the required day

- [x] 10.1 Show the CRM layout and the CRM view of the task manager as the week calendar, with the lead's name on each task
- [x] 10.2 Require a day for tasks of leads in the API; start the lead task form with today and keep its dates block
- [x] 10.3 Tests for both; run `npm test` and `npm run test:web`

## 11. Period fields in the header

- [x] 11.1 Show От and До in the CRM header, bound to the arrival period filter in every layout
- [x] 11.2 Tests for the board, the table, clearing and a reversed period; run `npm run test:web`

## 12. Close out

- [ ] 12.1 Run `openspec validate crm-lead-tasks-and-notes --strict`, `npm test` and `npm run test:web`, then archive the change
