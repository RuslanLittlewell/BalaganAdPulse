## Why

Finished tasks pile up in Готово because nothing moves them on: somebody has to drag each one to
the archive by hand. The board also has no place for work that is agreed but not started, so
Идея mixes raw ideas with tasks waiting for their turn.

## What Changes

- The board gets a seventh column, В очереди (`QUEUED`), drawn right after Идея.
- A task records when it entered Готово.
- A task that has stayed in Готово for 24 hours is moved to the archive column by the API.
- An admin can approve a done task from its card, which moves it to the archive column at once.
- The archive column keeps its rule: a task that has been there for seven days is shelved into
  the «Архив» module.

## Capabilities

### New Capabilities

### Modified Capabilities
- `task-board`: seven columns instead of six, with `QUEUED` counted as work in flight and
  offered in the task form's stage select.
- `task-archive`: a done task reaches the archive after 24 hours or on an admin's approval.

## Impact

- `apps/api`: `QUEUED` value in the `task_column` enum, `done_at` column on `task`, a worker
  that archives day-old done tasks and publishes the moves to open boards.
- `apps/web`: the new column on the board, in the stage select and in the activity log, and the
  В архив control on done cards for admins.
- `README.md`: the board's column list and the archiving rule.
