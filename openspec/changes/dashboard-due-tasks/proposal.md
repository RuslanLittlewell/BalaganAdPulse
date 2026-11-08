## Why

The dashboard's Важная информация block lists only projects without a KPI. A member who opens the dashboard each morning has to go to the tasks screen to see what is due. The block should show that work directly.

## What Changes

- The dashboard gets a block of its own, Задачи на сегодня и ближайшие дни, listing the viewer's tasks that are overdue, due today or due within the next two days. It is the third of four blocks, after the KPI gauge and Важная информация and before the sources, and the four stand in one row on wide screens.
- Each task shows its title, when it is due and how urgent that is. A click opens the task on the tasks screen.
- Overdue tasks come first, then the rest by due date and time.
- The block appears only for members whose organization has the tasks module. Without it, the dashboard keeps its three blocks in one row.

## Capabilities

### New Capabilities

- `dashboard-due-tasks`: which tasks the dashboard lists as due soon, in what order, how each is labelled, and what the list does when it is empty, loading or unavailable.

### Modified Capabilities

## Impact

- **Web.** `widgets/agency-overview` gets a due-tasks section in `ImportantInfo`, a due-soon rule in `entities/task`, and Russian copy in `ru.ts`. The dashboard reads the existing tasks list and its live updates, so no API change is needed.
- **API.** None.
- **Assumption.** "Mine" means tasks that list the viewer as a participant, plus tasks the viewer created that have no participants. Both are compared by the organization membership id, which is what tasks store. Tasks of other people stay on the tasks screen.
