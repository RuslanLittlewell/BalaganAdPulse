## Context

`TaskFormDialog` sets its defaults from the task it edits, or blank for a new one, and shows
the `Назначить` block whenever a project or a responsible member is set. The project page
lists tasks in flight through `TaskList` and opens them in `TaskPreviewDialog`. The create
permission is the same one the task module checks.

## Goals / Non-Goals

**Goals:**
- Raise a task from a project in one step, with the project and the member preset.

- Open a task from a project exactly as the task module does.

**Non-Goals:**
- Moving a task between stages by dragging on the project page.
- Reworking the read-only view itself.
- A create control on other task lists or in the project list sidebar.

## Decisions

- **The form takes the new task's project and responsible member as props.** They apply
  only when no task is given, so editing is unaffected. Because the form already shows a
  block holding a value, `Назначить` opens filled with no change to the block model.
  Alternative: an `initial` task object, rejected as it would blur the line between
  creating and editing that the form keys on `task`.
- **The page, not the form, decides who "me" is.** It looks up the signed-in user's
  membership among the staff the form offers and passes it only when found, so a customer,
  who is never offered as responsible, gets a form with only the project set.
- **`TaskList` renders the control itself, as an `AddTile` cell of its card grid, and takes
  `onCreate`.** The tile takes the height of its row and sits after the cards, or alone when
  there are none, the way the summary's add tile follows its tiles. The page passes
  `onCreate` only when the member may create tasks, following the rule that buttons are
  never handed down as elements.

- **Opening, editing, raising and deleting move into `TaskDialogs`.** Both pages hand it what
  is open — nothing, a task, or a new task with its column, project and member — and it
  picks the form or the read-only view by the update permission, and owns the delete
  confirmation. The task module's behaviour is unchanged; the project page cannot drift from
  it. Alternative: repeating the dialog state and confirmation in the project page, which
  is how the two would start to differ.
- **The board's card is split from its dragging.** `TaskCardView` in the task-management
  feature renders the card and, when handed the sortable attributes and listeners, its drag
  handle; the board's `TaskCard` only calls `useSortable` and passes them on. The project
  list renders `TaskCardView` without them, with `showColumn` adding the stage chip the
  board's columns otherwise stand for. The card is a button only when it can be opened.
  Alternative: rendering the board's `TaskCard` outside a drag context, which would tie one
  widget to another and keep dragging code where nothing is dragged.

## Risks / Trade-offs

- [The staff list may still be loading when the control is chosen] → the form then opens
  with only the project set, and the member picks themselves; the list is already fetched
  for the task cards' avatars, so this is rare.
