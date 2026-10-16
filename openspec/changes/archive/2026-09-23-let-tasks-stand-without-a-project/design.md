## Context

`Task.projectId` is a non-null column with a cascade from `project`, and reach is computed
through it: `reachFilter` narrows a non-admin to tasks whose project they hold a grant for,
`ownershipFilter` narrows them further to the tasks they are responsible for. Audit rows
carry a `clientId` resolved from the project. `TaskFormDialog` renders its blocks where they
sit in the JSX, with the project and the priority always shown and the client switch in the
grid of selects.

The board already draws a task with no project as `Без проекта` — the string and the fallback
were written when the column was still required. See proposal.md for why it stops being.

## Goals / Non-Goals

**Goals:**
- A task with no project behaves like any other task everywhere except where a project is
  what answers the question.
- One place in the form decides the order of the blocks.
- No task stored today changes in any way.

**Non-Goals:**
- A place in the interface that lists only the projectless tasks; they sit on the board and in
  the calendar with everything else.
- Giving a projectless task a client by another route.
- Reordering the blocks by hand.

## Decisions

### Reach for a task with no project is its own rule, beside the project one

`reachFilter` becomes a disjunction: a task is reachable when its project is reachable, **or**
when it has no project and the actor created it or is responsible for it. Admins keep
`{ orgId }`, which already covers both. `ownershipFilter` is unchanged, so a manager still
sees only their own work — for a projectless task, "their own" is what they wrote or were
given.

Reading one task by id follows the same filter, so a colleague's note answers 404, the same
answer an unreachable project's task gives. A `CLIENT` is excluded by requiring a project for
the customer filter, so `visibleToClient` can never let a client at a task with no client.

An "owner" column on the task was rejected: `created_by_id` already records who wrote it and
`assignee_id` who has it, and a third field would have to be kept in step with both.

### The project column becomes nullable, and its dependants follow

`project_id` drops `NOT NULL`; the foreign key keeps its cascade, which now only fires for a
task that has a project. Every task stored today keeps its project, so the migration moves no
data and can be rolled back by restoring the constraint once no null remains.

`campaign_id` is already nullable and is cleared whenever the project changes; the same code
path clears it when the project is cleared. `visible_to_client` stays a plain boolean and is
refused rather than made nullable: "not shared" is what a task with no client is.

The audit write takes `clientId: null` for such a task. The column already allows it, so
nothing else in the audit trail changes.

### The form's order lives in one list, not in the JSX

`TASK_BLOCKS` already names the blocks in one place; it becomes the order they are rendered
in — `checklist`, `dates`, `assign` — and the form maps over it rather than writing each block
where it happens to sit. The row of controls maps over the same list, so adding a block later
means touching one array.

`Назначить` replaces the separate `assignee` and `campaign` blocks and carries the project as
well. It is shown when any of the three has a value, and removing it clears all three. The
project select inside it offers a `Без проекта` choice, so the block can be kept for a
campaign-less task that still names a responsible member.

### The client switch belongs to the dialog, not to a block

It moves into `DialogFooter`, on the left of the buttons. It is shown only to a member who may
change it and only while the task has a project, which is the same condition the API enforces,
so the interface never offers a control whose request would be refused.

## Risks / Trade-offs

- [A manager writes a projectless note, is removed from the organization, and their note is
  left reachable only by admins] → The same is already true of every task they were
  responsible for; the audit trail keeps who wrote it.
- [A task loses its project and, with it, the client's view of it] → Clearing a project clears
  the campaign and refuses the client mark, so the task cannot silently stay shared with a
  customer it no longer concerns.
- [The board can now show a column of notes nobody else can see] → That is the point of the
  feature; admins still see everything.
- [**BREAKING** for an API client that relies on `projectId` never being null] → The only such
  client is this web app, which changes in the same commit.

## Migration Plan

One migration, reversible while no task has a null project:

1. `ALTER TABLE "task" ALTER COLUMN "project_id" DROP NOT NULL`.

Nothing is backfilled and no row is touched: every stored task keeps the project it has, and a
request that names one behaves exactly as it does today. Rolling back means setting a project
on any task that has none and restoring `SET NOT NULL`.
