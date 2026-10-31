## Context

`TaskFormDialog` renders a `DialogHeader` (title, stage and priority), a form whose body is a
two-column grid (description, checklist, attachments and comments in a scrolling column; the
optional dates and assignment blocks beside it) and a `DialogFooter` (client sharing, delete,
cancel, save). `TaskPreviewDialog` is the read-only view clients get. Tests find the save,
cancel, stage and priority controls by name and assume each appears once.

## Goals / Non-Goals

**Goals:**
- A phone composition with the save and close controls always in reach and one scroll.

**Non-Goals:**
- Summary rows that open each parameter in a sheet of its own; the parameter blocks keep their
  controls.
- The task board on a phone.

## Decisions

- **`useNarrowScreen` decides where controls render; `max-md:` classes decide how things look.**
  Save, close, stage and priority must move between the header and the form. Rendering them twice
  and hiding one with CSS would put two of each in the document, which assistive technology and
  the tests would both meet. The hook reads `not all and (min-width: 48rem)`, the query Tailwind
  emits for `max-md`, so the two agree, and it reports a wide screen where `matchMedia` is
  missing, as in the test environment.
- **The top bar's save button sits outside the form and submits it through `form=`**, so the
  header can stay where it is in the tree.
- **The close control is the cancel action as an icon**, named «Отмена» or «Закрыть» as the
  footer button it replaces; the dialog's own corner close is not rendered on a phone.
- **The stage and priority become a label/value grid after the title field** on a phone, and the
  parameter column moves before the description with `order-first`, so the page reads from what
  a task is to what it says.
- **The sheet scrolls its form, not the dialog.** The header stays outside the scroller and the
  body drops its `min-h-0` shrink on a phone so it cannot collapse over the footer.
- **`PHONE_SHEET_CLASS_NAME` in `shared/ui`** holds the full-screen overrides, so the preview and
  later dialogs share them.
- **`sm:` becomes `md:` for the two columns**, so between 640 and 768 px the dialog is the phone
  sheet rather than a squeezed two-column window.

## Risks / Trade-offs

- [The breakpoint is named in CSS and in the hook] → both read 48rem through the same media
  query, and the hook's tests pin the phone composition.
