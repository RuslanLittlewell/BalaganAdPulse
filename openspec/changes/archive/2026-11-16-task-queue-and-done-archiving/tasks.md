## 1. API

- [x] 1.1 Add `QUEUED` to the `task_column` enum after `IDEA`, and to the domain's column list.
- [x] 1.2 Add `done_at` to `task`, stamped with the migration time for tasks already done; stamp it when a task enters `DONE` and clear it elsewhere.
- [x] 1.3 Add the use case that archives tasks done 24 hours ago and publishes their moves.
- [x] 1.4 Add the worker that runs it every five minutes, started and stopped with the server.
- [x] 1.5 Cover the new column, the stamping and the archiving with tests.

## 2. Web

- [x] 2.1 Add `QUEUED` to the board, the stage select, the activity log and the Russian copy.
- [x] 2.2 Add the В архив control to done cards for admins.
- [x] 2.3 Cover the column and the control with tests.

## 3. Verification

- [x] 3.1 Update the README's description of the board.
- [x] 3.2 Run `npm test` until green; `openspec validate task-queue-and-done-archiving --strict`.
