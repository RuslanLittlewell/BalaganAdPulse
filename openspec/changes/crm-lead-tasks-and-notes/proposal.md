## Why

A media buyer works a lead through calls, reminders and follow-ups, but a task cannot name a lead, so that work lives in a separate list with no link back to the person. A lead also has no place for running comments: the single Описание field holds one block of text that members overwrite. And the lead panel is 480 pixels wide, which no longer fits its tabs.

## What Changes

- A task may belong to a lead. A task with a lead belongs to the lead's project and cannot be moved to another project or detached from the lead.
- The task manager gets a fourth view, CRM, beside Доска, Календарь and Звонки. It shows only tasks that belong to leads. Tasks of leads no longer appear in the other three views.
- A task created in the CRM view must name a lead.
- The lead panel gets a Задачи tab. It lists the lead's tasks and creates a new task for that lead.
- The lead panel gets a Заметки tab. Members write comments on the lead, edit and delete their own, and read the rest oldest first.
- The lead panel opens wider so that all tabs fit on one row.
- The CRM page shows its layouts Канбан, Задачи and Таблица as tabs in its header. Настройки no longer offers Раскладка.
- The Календарь layout, which arranged leads by arrival day, is replaced by Задачи: the tasks of the selected board's leads, with creating, opening and completing.
- A new lead always gets a person, so it appears in Люди at once, whether a member created it or an integration imported it.
- The filter Дата поступления, and the custom Дата fields, get the operator в период with От and До, so a member counts the leads that arrived in October.
- Deleting a lead deletes its tasks and notes.

## Capabilities

### New Capabilities

- `lead-tasks`: tasks that belong to a lead, the CRM view of the task manager, and the lead's own task list.
- `lead-notes`: comments written on a lead.

### Modified Capabilities

- `lead-side-panel`: the panel offers the Задачи and Заметки tabs, opens wider and opens from every layout.
- `crm-board-view`: layout tabs in the CRM header, Настройки without Раскладка, the filter operator в период.
- `crm-record-table`: Таблица is chosen from the header tabs.
- `crm-records`: a new lead always gets a person.
- `module-transitions`: the no-fade scenario names the tasks layout instead of the calendar.
- `lead-calendar`: removed; Задачи replaces it.

## Impact

**BREAKING**: the Календарь layout of CRM is removed. A remembered Календарь choice falls back to Канбан.

- API: `Task` gains an optional lead reference, a new `LeadNote` model, one Prisma migration, person creation inside lead creation and import, task list filtering by lead, note endpoints under the lead's board routes, OpenAPI documentation for both.
- Web: a CRM view in `TasksPage`, task entity queries for lead tasks, two tabs in `lead-side-panel`, a wider `SidePanel` for the lead panel, layout tabs in the CRM header and the Задачи layout in place of `crm-calendar`, the в период filter, Russian copy in `ru.ts`.
- Existing tasks are untouched. They have no lead and stay in the three existing views.
