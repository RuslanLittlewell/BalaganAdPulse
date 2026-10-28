## Why

The task form offers a client «Без проекта», but the API refuses such a task: everything a
client raises is marked visible to the client, and a task with no project concerns no client.
A client wants to keep their own to-dos in the task module, seen by nobody but themselves.

## What Changes

- A `CLIENT` or `CLIENT_ADMIN` may raise a task with no project. It is stored as their
  personal task: not marked visible to the client, reached by its author alone — not by
  admins, managers, or the client's other people.
- The author may change, move, complete and delete their personal task, as a manager may.
  It stays without a project and names nobody.
- Realtime events and notifications about it reach its author alone.
- A personal task writes no audit events, since the activity log is the agency's.
- The task form tells a client that a task without a project is seen by them alone, and
  the board, calendar and form offer them editing controls on their personal tasks.
- A client opens any task in the same form an admin sees, without the Видно клиенту switch.
  On a task on a project every field is read-only and there is no save or delete.

## Capabilities

### New Capabilities

### Modified Capabilities
- `task-board`: who reaches a task with no project, what each role sees, who changes tasks,
  and which mutations are audited.
- `access-control`: a client raises, changes and deletes their own personal task.

## Impact

- Database: `task.personal`, a boolean defaulting to false.
- API: the task payload gains `personal`; reach filters for admins and customers, realtime
  delivery, notification recipients and task audit change.
- Web: the task form, dialogs, board, calendar and list decide editing per task.
