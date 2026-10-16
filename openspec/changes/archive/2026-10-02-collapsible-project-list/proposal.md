## Why

The project list takes a fixed column beside every project, which leaves less room for the
campaign table, and a project can only be edited through a small pencil that is easy to
miss.

## What Changes

- A handle on the border between the list and the project narrows the list to project
  pictures and widens it back; the choice is remembered.
- Narrowed, projects show their names in tooltips, search becomes a magnifier opening a
  small field, and dragging is off.
- Every project's context menu gets Редактировать for members who may update projects.

## Capabilities

### New Capabilities

### Modified Capabilities
- `project-list-layout`: a narrowed list and editing from the context menu.

## Impact

- `apps/web/src/pages/projects/ProjectsPage.tsx`, `apps/web/src/widgets/project-list/*`,
  a storage helper in `shared/lib`, `ru.ts`. No API change.
