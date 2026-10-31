## Why

Below 1024 px the projects module has no side column: its project list stacks above the chosen
project at full length, so on a phone or a tablet the project itself starts screens below.

## What Changes

- Below 1024 px the project list becomes a dropdown: a button naming the chosen project and its
  client opens the whole list (search, pinned projects, groups and the create button) over the
  page.
- Choosing a project there opens it and closes the list.
- The list's collapsed state, chosen on a wide screen, does not apply to the dropdown.
- From 1024 px the list stays the collapsible side column.

## Capabilities

### New Capabilities

### Modified Capabilities
- `mobile-layout`: the project list is a dropdown where the projects module has no side column.

## Impact

- `apps/web/src/widgets/project-list/ProjectList.tsx`: the dropdown below `lg`.
- `apps/web/src/pages/projects/ProjectsPage.tsx`: the page gives the dropdown its own row.
- `apps/web/src/shared/lib/useNarrowScreen.ts`: takes the breakpoint to compare with.
- `apps/web/src/shared/config/ru.ts`: the dropdown's names.
