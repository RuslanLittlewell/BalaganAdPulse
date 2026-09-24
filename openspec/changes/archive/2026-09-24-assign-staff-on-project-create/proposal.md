## Why

A new project is invisible to every manager and guest until an admin leaves the project
form, opens the contact book, finds each employee and adds the project to their access one
by one. Staffing a project is part of making it, so the form that makes it should do it.

## What Changes

- `POST /api/projects` accepts an optional `memberIds` list. Each named employee is given
  access to the new project in the same transaction that creates it; if any of them cannot
  be given access, nothing is stored.
- Only members who may manage other members' access (admins) may name employees. Anyone
  else naming one is refused and nothing is stored; leaving the list out or empty keeps
  project creation open to everyone who may create a project today.
- An employee is an active manager or guest of the creator's organization. Admins, customers,
  suspended members and members of another organization are refused.
- The project form, when creating a project and shown to an admin, offers a Сотрудники
  picker listing the organization's active managers and guests. It is not offered when
  editing a project, nor to members who may not manage access.

No breaking changes: the field is optional and the response is unchanged.

## Capabilities

### Modified Capabilities
- `project-management`: adds the requirement that staff can be assigned to a project as it
  is created, from the API and from the project form.

## Impact

- **API** (`apps/api`): the project create schema, OpenAPI component, project use cases and a
  new port for granting project access, implemented over `client_access` beside the existing
  invitation adapter in the members module and wired in composition. No schema change.
- **Web** (`apps/web`): `ProjectFormDialog`, `ProjectInput`, and new strings in `ru.ts`.
- **Data**: none — grants are ordinary project-scoped `client_access` rows, managed afterwards
  in the contact book exactly as today.
