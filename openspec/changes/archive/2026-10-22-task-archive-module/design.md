## Context

Tasks have a `column`; `ARCHIVED` is one of six. `updatedAt` cannot say when a task was
archived because reordering a column rewrites the position, and so `updatedAt`, of every task
in it. The web app already receives every visible task from one list request and filters it
by project and participant in the browser.

## Decisions

- **`archivedAt` column.** Added to `task`, backfilled from `updated_at` for tasks already
  archived. `applyOrder`, which every column change goes through, stamps it on tasks entering
  `ARCHIVED` that have none and clears it on tasks in any other column. A task created straight
  into `ARCHIVED` is stamped too.
- **Shelving is computed in the browser.** `isShelved(task, now)` is true for a task in
  `ARCHIVED` whose `archivedAt` is seven days old or older. No scheduled job or new endpoint:
  the same task list feeds the board and the module, so a task moves between them as the clock
  passes the threshold.
- **Filters, not a new query.** The archive page reuses the participant and project choices and
  filters of the tasks page, each remembered separately from the board's so narrowing one module
  does not narrow the other.
- **List, not board.** Shelved tasks render as rows using the existing task dialog on click.
