## Why

With dozens of projects, picking one from a select means scrolling a long list, and the search
field of the project list gives no sign of what it is.

## What Changes

- Every select that offers the projects to choose from has a search field at the top of its list
  that narrows the options as the member types: the report filter, the new report dialog, the task
  form, the task board's project filter and the activity log's filters.
- The project list's search field shows a search icon.

## Capabilities

### New Capabilities

### Modified Capabilities
- `project-management`: project selects can be searched.
- `project-list-layout`: the search field carries an icon.

## Impact

- `apps/web/src/shared/ui`, and the screens that offer a project to choose.
- No API change.
