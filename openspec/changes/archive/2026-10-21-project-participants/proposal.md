## Why

The new-project form calls the people it assigns "Сотрудники" and lists only managers and
guests. Admins work on projects too, and an admin creating a project is the first person who
should be on it; leaving them out of the list and out of the default makes them add themselves.

## What Changes

- The picker in the new-project form is renamed **Участники**.
- It lists the organization's active admins as well as its managers and guests.
- Every active admin is chosen by default; the creator can unchoose any of them or add others.
- API: an admin is an eligible participant of a new project.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-management`: who may be named when a project is created, and the form's picker.

## Impact

- API: `modules/members` project staffing (the eligible roles).
- Web: `features/project-management` form, the Russian copy.
