## Context

`ProjectsPage` lays out a 200px list column and the project, separated by a left border on
the project column. `ProjectList` renders the search field, pinned rows, groups and rows;
rows are `ProjectRow` → `ProjectItem` (a `ListItem` with avatar, name, client and a pencil).
The main navigation already collapses, storing its state in localStorage and showing names
in `WarmTooltip`s.

## Goals / Non-Goals

**Goals:**
- A narrowed list with pictures, tooltips, search and context menus.

**Non-Goals:**
- Dragging while narrowed.
- Narrowing on small screens, where the list already stacks above the project.

## Decisions

- **State in the page, stored like the navigation's.** `readProjectListCollapsed` /
  `writeProjectListCollapsed` in `shared/lib`; `ProjectsPage` owns the flag, sets the grid
  column to 200px or 64px and passes `collapsed` to `ProjectList`.
- **Handle inside the project column's wrapper.** The project column becomes a `relative`
  wrapper carrying the border, with the scrolling area inside it, so the handle can sit on
  the border at 50% height without being clipped by the scroll container.
- **Narrowed rows.** `ProjectItem` renders an avatar-only button wrapped in `WarmTooltip`
  with the project's name; the row keeps its context menu. Groups hide their header text and
  show their name in a tooltip on a slim header.
- **Search popover.** A magnifier button opens a `Popover` holding the same search input and
  state; a popover rather than a dropdown menu, because menus capture typed letters for
  their own navigation.
- **Editing.** `ProjectRow` adds Редактировать to its context menu when `onEdit` is given;
  `ProjectList` already passes `onEdit` only to members who may update projects.

## Risks / Trade-offs

- [Long lists of pictures are hard to scan] → tooltips and the search popover; widening is
  one click.

## Migration Plan

Web-only.
