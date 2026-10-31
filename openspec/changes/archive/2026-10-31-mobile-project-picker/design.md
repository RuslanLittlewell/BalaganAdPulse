## Context

`ProjectsPage` lays out `ProjectList` and the chosen project side by side from `lg`
(`lg:grid-cols-[200px_…]`); below it the grid has one column and the list stacks above the
project. `ProjectList` holds the search, the pinned group, the sortable groups and rows, the
create button and the dialogs it opens (new group, new project, edit project). Its `collapsed`
prop shows rows as avatars only.

## Goals / Non-Goals

**Goals:**
- One compact control for choosing a project where there is no side column.

**Non-Goals:**
- Changing the list itself: search, pinning, groups and sorting stay as they are.

## Decisions

- **The boundary is `lg`, the projects module's own**, not `md`: between 768 and 1024 px the list
  stacks above the project just as on a phone.
- **`useNarrowScreen` takes the breakpoint**, `"md"` by default and `"lg"` here, reading the same
  `not all and (min-width: …)` query Tailwind emits.
- **One panel, placed inline or in a `Popover`.** The list's content is built once; on a wide
  screen it is the column, below `lg` it is the content of a `Popover` opened by a trigger naming
  the chosen project. The `Popover` closes on a choice, on Escape and on a click outside, and
  nests the rows' menus as child layers.
- **The dialogs stay outside the `Popover`**, so creating or editing a project from the dropdown
  keeps its dialog when the dropdown closes.
- **`collapsed` is ignored below `lg`**, so the dropdown always shows names.
- **The page gives the dropdown an `auto` row** (`max-lg:grid-rows-[auto_minmax(0,1fr)]`), so the
  project fills the rest.
