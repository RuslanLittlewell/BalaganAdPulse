## Context

`TaskDescriptionEditor` is one TipTap editor used three ways: editable while a task is being
created, a read view that `TaskFormDialog` switches to editing with «Изменить», and a
permanent read view in `TaskPreviewDialog` for members who may not edit tasks. Whether it is
editable is the parent's state; the editor only follows its `editable` prop. Its wrapper
already handles clicks: a link opens in a new tab, and while editable a click on the padding
focuses the text.

## Goals / Non-Goals

**Goals:**
- A click on the read view starts editing at the clicked place.

**Non-Goals:**
- Leaving editing by clicking elsewhere or pressing Escape; «Готово» stays the way out.
- Click-to-edit in the preview for members who may not edit tasks.
- Inline editing of the comment or checklist texts.

## Decisions

- **The editor asks, the parent decides.** The editor gains an `onEdit` callback and calls it
  when its read view is clicked; `TaskFormDialog` passes one that turns editing on, and the
  preview passes none, so it stays read-only without a new flag. Alternative: the editor
  holding its own editing state, which would split the «Изменить» button and the click
  between two owners.
- **The caret lands where the click did.** The document position under the pointer is taken
  with ProseMirror's `posAtCoords` at the moment of the click, before the toolbar appears and
  pushes the text down, and the editor focuses that position once it is editable. A click past
  the text gives no position, and the caret goes to the end.
- **Clicks that mean something else are left alone.** A link is followed by the existing
  `followLink`; a click inside a button, which is how an attachment renders, opens that
  attachment; a click while the page has a non-empty selection ends a selection meant for
  copying. None of them asks to edit.
- **The read view shows a text cursor** so the area reads as something to click into.

## Risks / Trade-offs

- [A member clicking only to read may enter editing by accident] → editing changes nothing
  until they type, and «Готово» returns to the read view; the task is saved only by
  «Сохранить».
