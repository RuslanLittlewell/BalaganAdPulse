## 1. The stage in the form's header

- [x] 1.1 Add the Этап select next to Приоритет in `TaskFormDialog`'s header, offered only when the member may update tasks, listing `TASK_COLUMNS` in order, holding the task's column, or for a new task the column it was opened from or `IDEA`; add its label to `ru.ts`.
- [x] 1.2 On save, create a new task in the chosen column; for an existing task whose stage changed, move it to position 0 of the chosen column through the existing move before updating its other fields, keeping the form open with the move's failure message when it is refused.
- [x] 1.3 Keep the stage out of the form for a client, whose task is created in `IDEA` as before.

## 2. Coverage

- [x] 2.1 Cover the form: the select shown with the current stage and all six stages, absent for a client, a new task from a column showing that column, a new task created in the chosen stage, a changed stage moving the task to the top of it, an unchanged stage sending no move, a refused move keeping the form open with the message.
- [x] 2.2 Run `npm run test:web` until green; `openspec validate task-stage-select --strict`.
