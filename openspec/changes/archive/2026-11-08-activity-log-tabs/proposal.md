## Why

The history window shows one long feed of everything that happened in the organization. To
answer "what happened on this project" or "what did this person do today" one has to scroll and
read every entry. And the question "when did they come online, when did they leave" has no
answer at all: presence is held in memory and forgotten.

## What Changes

- The history window gets two tabs, **Проекты** and **Сотрудники**.
  - **Проекты** shows events tied to a project, with a select of the projects the viewer
    reaches; choosing one shows that project's events only.
  - **Сотрудники** shows everything the viewer may read, with a select of the people who
    appear in it; choosing one shows that person's actions only.
- A member coming online and going offline is recorded in the audit trail as `ONLINE` and
  `OFFLINE` events: online at their first request after being away, offline when they sign
  out, or at their last request when five minutes pass without another. These events concern
  no client or project, so only admins read them.
- The history window shows the exact time of each event on hover, and of coming online and
  going offline outright.
- API: `GET /api/audit` accepts `inProject=true`; `GET /api/audit/actors` lists the people who
  appear in the events the caller may read.

## Capabilities

### New Capabilities

- `activity-log`: the history window, its tabs and filters, and how it shows events.

### Modified Capabilities

- `audit-trail`: reading gains the project-only filter and the list of actors; presence
  changes are recorded.

## Impact

- Prisma: `ONLINE` and `OFFLINE` added to the `audit_action` enum. Existing events are
  untouched.
- API: `modules/audit` (the event time, the actors query, the filter, OpenAPI);
  `modules/presence` hands the moment of each arrival and departure to its announcements, a
  departure by silence dated at the last request; `composition` records them through the audit
  writer.
- Web: `entities/audit-event` (the new actions, filter and actors query), the
  `activity-log-modal` widget with the tabs and selects, copy in `ru.ts`.
