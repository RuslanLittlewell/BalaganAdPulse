## Context

Notifications already carry a task and open it through `/tasks?task=<id>`; the tasks page
reads that parameter once and then removes it. Staff see a task only when named on it, or when
they raised it with nobody named, or when they are admins; a client's person sees it only when
it is shared with the client.

## Decisions

- **Comments live in the tasks module.** A `task_comment` row holds the author, the text and
  the ids of the tagged members; comments are removed with their task.
- **Tagging is sent as ids.** The text keeps `@Name` for reading; the request lists the tagged
  member ids, which the server checks against the organization and the project, the way
  participants are checked. The field offers only the people who can see the task: its
  participants, its creator and the admins.
- **One notification kind.** `TASK_MENTIONED` is sent to tagged members other than the author,
  through the same filter that hides unshared tasks from a client's people. A customer cannot
  tag anyone, as a customer names nobody on a task.
- **Comment access follows task access.** Whoever can reach the task can read and write its
  comments; the author or an admin deletes.
- **The address is the source of truth.** The tasks page and the archive read the opened task
  from `?task=` and write to it: opening pushes the parameter, closing replaces it away, and an
  address naming a task the member cannot reach opens nothing.
