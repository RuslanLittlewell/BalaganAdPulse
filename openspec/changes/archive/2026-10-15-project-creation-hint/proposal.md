## Why

A new organization's projects module opens on an empty list, and its add button is a bare
"+" at the foot of the list.

## What Changes

- A hint, "Создайте проект", points at the projects module's add button while there are no
  projects, for whoever may create one, until it is closed.
- A hint, "Добавьте клиента", points at the new-project dialog's add-client button while
  there are no clients, for whoever may create one, until it is closed — a project needs a
  client.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `onboarding-hints`: hints on the add-project button and on the new-project dialog's
  add-client button.

## Impact

- Web only: `ru.ts`, `features/hints`, `widgets/project-list/ProjectList`,
  `features/project-management/ProjectFormDialog`.
