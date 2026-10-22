## Why

The «Архив» item in the navigation opens an empty placeholder, while the task board's archive
column only grows: tasks that were archived long ago keep crowding the board.

## What Changes

- A task records when it was moved into the archive column; leaving the column clears it.
- A task that has stayed in the archive column for a week or more is shelved: the task board
  and calls view stop showing it and the «Архив» module lists it instead.
- The «Архив» module is a plain list of shelved tasks, newest archived first, that can be
  narrowed by project and by participant.
- Opening a shelved task shows the usual task dialog, so it can be restored to another column.

## Capabilities

### New Capabilities
- `task-archive`: the archive module and the shelving of long-archived tasks.

### Modified Capabilities

## Impact

- `apps/api`: `archived_at` column on `task`, set and cleared when a task changes column,
  returned as `archivedAt`.
- `apps/web`: archive page, shelving rule in `entities/task`, tasks page excludes shelved tasks.
