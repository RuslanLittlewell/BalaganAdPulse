## 1. The checkbox on the card

- [x] 1.1 Replace the repeating task's completion button in `TaskCardView` with a Готово checkbox shown when the card is given a toggle handler, ticked when the task is in `DONE`, named with the task's title, and stopping click, key and pointer events from opening or dragging the card; add its copy to `ru.ts`.
- [x] 1.2 Add a shared toggle that decides the action from the task: completion for a repeating task outside `DONE`, a move to `DONE` position 0 for any other task outside `DONE`, a move to `IN_PROGRESS` position 0 for a task in `DONE`, all through the existing `useMoveTask` and `useCompleteTask` with their optimistic updates and refusal messages.
- [x] 1.3 Pass the toggle to cards on the board, in the calendar (full-size and compact) and in the project's list of work in flight, only when the member may update tasks.

## 2. Coverage

- [x] 2.1 Cover the card: the checkbox's presence by permission, its ticked state from the column, its accessible name, Space toggling it, a tick not opening the task.
- [x] 2.2 Cover the wiring: closing from the board, the calendar and a project's list; reopening from `DONE`; completing a repeating task; a refused change restoring the card and showing the message.
- [x] 2.3 Run `npm run test:web` until green; `openspec validate task-quick-complete --strict`.
