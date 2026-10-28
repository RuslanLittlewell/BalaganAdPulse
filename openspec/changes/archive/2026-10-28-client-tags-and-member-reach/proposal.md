## Why

A client who tags somebody in a comment cannot send it: the API refuses any tag from a
client's person, while the comment field still offers people to tag. The people it offers
come from the organization's member list, which a client principal reads in full — every
employee and every other client's people, with their emails — though only admins may list
members. And in a task a client may only read, the project and repeat fields look disabled
yet open their list of choices.

## What Changes

- A client's person may tag the active people named on the task, and nobody else. The comment
  field offers them exactly those people.
- **New endpoint** `GET /api/tasks/:id/participants` answers, to everyone who reaches the task,
  the active people named on it with their names and pictures.
- A `CLIENT_ADMIN`'s `GET /api/members` returns only the people of the clients they reach.
- A choice list inside a part of a form that is disabled no longer opens.

## Capabilities

### New Capabilities

### Modified Capabilities
- `task-comments`: who a client's person may tag, and reading the people named on a task.
- `organization-membership`: what a client principal's member list holds.
- `task-board`: a client's read-only task form opens no list of choices.

## Impact

- API: tag validation for customers, the new participants route, the member list for a
  customer principal, OpenAPI.
- Web: the comment field's offer for customers, the shared select trigger.
