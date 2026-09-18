## Context

`TaskFormDialog` drives one `react-hook-form` over every field a task carries, laying the
selects out in a fixed grid and rendering `TaskSchedule` and `TaskChecklist` unconditionally.
`TaskChecklist` is the odd one: it mutates the server directly through
`useAddChecklistItem`, `useChangeChecklistItem` and `useRemoveChecklistItem`, keyed by a task
id, which is why it is rendered only when a task already exists — and why ticking an item
takes effect while the rest of the form is still unsaved.

On the API side, `create` in the task use cases builds one `NewTask` inside
`unitOfWork.run`, claims the description's images in the same transaction and writes one
audit event. `task_checklist_item` and the repository methods that write it already exist,
so nothing here needs a migration.

See proposal.md for why.

## Goals / Non-Goals

**Goals:**
- One place in the form that decides what is shown, whether the task exists or not.
- A checklist behaves like every other field of the form: changed in the dialog, stored on
  save.
- The block controls read from the same values the form submits, so shown and stored never
  drift apart.

**Non-Goals:**
- Labels, attachments in the row, and reordering the blocks themselves.
- Remembering which blocks a member likes to open.
- Keeping the per-item endpoints: an item is no longer addressable on its own.

## Decisions

### Which blocks are shown is derived, not stored

The form holds one `Set<Block>` of blocks the member has opened in this dialog. What is
actually shown is that set unioned with the blocks whose current form value is not empty —
a due date, a checklist with items, a chosen member, a chosen campaign. The row offers
exactly the blocks that are not shown.

This means a task being edited opens with its own blocks already out, with no effect needed
to seed the set, and closing a block is expressed as clearing its values plus dropping it
from the set. Keeping a second piece of state that says "this block is open" independent of
its value was rejected: the two would have to be kept in step on every reset, every rejected
save and every value cleared from elsewhere.

### The checklist is a field of the form, not a resource

`TaskChecklist` takes the items and the three callbacks that change them — add, change and
remove — and calls no API of its own. The form holds the list in `useState`, seeded from the
task being edited and empty for a new one, and submits it with everything else. Ticking an
item is then exactly as reversible as retyping the title: closing the dialog drops it.

An item needs an id for React keys and for the tick and remove handlers before the server
has given it one, so the draft mints one with `crypto.randomUUID`. Those ids are never sent
and never read back — the API assigns the real ones — so they cannot collide with a stored
id.

### Both create and update take the whole list

`createTaskSchema` and `updateTaskSchema` accept `checklist: { title, done? }[]`, and the use
cases write it inside the transaction they already open, before their audit event, so a
refusal anywhere rolls the checklist back with the task. On update the stored rows are
deleted and the given list written in its place: the list the client sends is the list the
task has.

A diff by item id was rejected. It asks the client to track which of its rows the server
knows about, and the server to decide what an unknown id means, to produce a result the
wholesale write already gives. Item ids stay inside the database, where nothing outside the
task needs them.

Because of that, the five per-item endpoints have no caller and no reason to exist; they go
with their use cases, their OpenAPI operations and the mutation hooks that called them. An
`updateChecklist` repository method replaces them: delete the task's rows, create the given
ones in order, inside the caller's transaction.

### The row is a plain set of buttons

A row of outline buttons under the title, each adding one block, sized and spaced like the
dialog's other controls. Each shown block carries a remove control with an accessible name
of its own, so the keyboard reaches both adding and removing, and the tests assert on those
names rather than on which element is drawn.

## Risks / Trade-offs

- [A member fills in a block, removes it, and loses what they typed] → Removing clears the
  value by design, because a block that is hidden but still stored is the drift this change
  is meant to end. The dialog is not saved until it is submitted, so the escape is to cancel.
- [**BREAKING** for any caller of the per-item endpoints] → Only this web app called them,
  and it stops in the same change. An API client that used them sends the checklist with the
  task instead.
- [Two members editing one task's checklist at once — the last to save wins the whole list,
  rather than merging item by item] → The same is already true of the title, the description
  and every other field of the form, and the board's realtime updates show the other
  member's save as it lands.
- [`crypto.randomUUID` is unavailable in an insecure context] → The draft falls back to a
  counter-based id; ids never leave the browser.

## Migration Plan

None. No Prisma model, column or constraint changes, so no migration and no data to move:
`task_checklist_item` already holds what create and update now write, and keeps its rows.
Every task stored today is unaffected, and a request that names no `checklist` leaves the
one the task has.
