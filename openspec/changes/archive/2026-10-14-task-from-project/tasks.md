## 1. Raise a task from its project

- [x] 1.1 Let `TaskFormDialog` take a project and a responsible member for a new task.
- [x] 1.2 Give `TaskList` an `onCreate` that shows a Новая задача `AddTile` after its cards, or alone in place of the empty note.
- [x] 1.3 Open the form from the project page with the project and the member's own membership, only for members who may create tasks.
- [x] 1.4 Cover the form defaults, the list control, and the project page: preset project and assignee, saving lists the task, no control for a guest.
- [x] 1.5 Run `npm run test:web` until green; `openspec validate task-from-project --strict`.

## 2. Open a task from its project as on the board

- [x] 2.1 Move opening, editing, raising and the delete confirmation into `TaskDialogs`; use it in `TasksPage` and `ProjectPage`.
- [x] 2.2 Cover the project page: a manager edits and deletes from the form, a guest reads; keep the task module's tests green.
- [x] 2.3 Split the board's card into `TaskCardView` and its dragging; show `TaskCardView` with the stage in the project's list.
- [x] 2.4 Cover the project's card: a full task, a bare one, no drag control; keep the board's tests green.
- [x] 2.5 Run `npm run test:web` until green; `openspec validate task-from-project --strict`.
