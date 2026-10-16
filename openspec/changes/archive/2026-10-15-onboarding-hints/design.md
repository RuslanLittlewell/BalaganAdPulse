## Context

The header's contact book button (`UserPlusIcon`, "Контактная книга") opens the directory
where employees are invited and clients created. The web app already holds the staff list
(`/members?kind=staff`, shared store) and the client list (React Query), and remembers
per-person interface choices in a persisted zustand store keyed by user id.

## Goals / Non-Goals

**Goals:** a reusable dismissible hint, and the first one on the contact book button.

**Non-Goals:** remembering dismissals on the server or across devices; a tour that chains
hints; hints for roles other than the organization admin.

## Decisions

- **`Hint` in `shared/ui` on Radix Popover**, anchored with `PopoverAnchor asChild` around
  the control it points at, so the control stays the control and keeps its own tooltip.
  It is controlled (`open`), ignores outside clicks and Escape, does not take focus, and
  closes only through its own close button, which it renders itself. It is announced
  politely (`role="status"`) and points at its anchor with an arrow.
- **Dismissals live in a persisted store per user id** (`adpulse-hints`), following the
  module memory. A dismissed hint never shows again for that person in that browser.
- **The condition is computed where the button is**, in the header: the person is an
  `ADMIN`, both lists have loaded, there is no client, and every staff member is the
  person themselves. While the contact book is open the hint is hidden, so it never sits
  on top of the dialog. Adding a client or an employee ends the condition on its own.

## Risks / Trade-offs

- A dismissal does not follow the person to another browser → acceptable for a hint; the
  store can move to the server when hints multiply.
