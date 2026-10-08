## Why

A member working in a project can only raise or change a task from the task module, then
has to name the project and themselves again in the form. The project's own list of work in
flight shows the tasks read-only, with too little on each card to tell them apart, and
offers no way to add one.

## What Changes

- The project's work-in-flight list gains a Новая задача tile for members who may create
  tasks, after its tasks or, when there are none, in place of the note that nothing is in
  flight.
- It opens the task form already naming the project and the member as responsible, both
  changeable.
- A task opened from the project opens as it does in the task module: in the task form, with
  saving and deleting, for members who may update tasks, read-only for everyone else. The
  opening, editing and delete confirmation move into one component both pages use.
- Each card in the project's list is the task board's card, with the task's stage added and
  without dragging; the board's card is split into that card and the dragging around it.

## Capabilities

### New Capabilities

### Modified Capabilities
- `task-board`: a task can be raised from its project and opens from it as on the board; its
  card there is the board's; the form opens with the values it is given rather than always
  bare. **BREAKING** for the read-only view from a project, which now only members who may
  not update tasks get.

## Impact

- `apps/web/src/widgets/task-list/TaskList.tsx`: the create tile.
- `apps/web/src/features/task-management/ui/TaskFormDialog.tsx`: a project and a responsible
  member for a new task.
- `apps/web/src/features/task-management/ui/TaskDialogs.tsx`: opening, editing, raising and
  deleting a task, shared by `TasksPage` and `ProjectPage`.
- `apps/web/src/features/task-management/ui/TaskCardView.tsx`: the board's card without
  dragging; `apps/web/src/widgets/task-board/TaskCard.tsx` keeps only the dragging.
- `apps/web/src/pages/project/ProjectPage.tsx`, `apps/web/src/pages/tasks/TasksPage.tsx`.
- No API change: tasks are already created with a project and a responsible member.
