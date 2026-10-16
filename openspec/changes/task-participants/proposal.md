## Why

A task names exactly one responsible member and is seen by nobody else on staff. Work is often
shared — a weekly call with a client involves several people from the agency and often the
client's own people — but only one of them finds it on their board or in their calendar. A
manager who oversees work somebody else does has no way to keep it in view either. One
responsible member is the wrong shape.

A call needs nothing of its own: it is a task with a time of day that repeats.

## What Changes

- **BREAKING** A task no longer has a responsible member. It names any number of participants
  (Участники), and everybody named sees it. `assigneeId` is no longer accepted or returned by
  the task API; `participantIds` takes its place. Every task's former responsible member becomes
  one of its participants.
- The task form's `Назначить` block carries the project and the participants. A new task starts
  with the member filling the form among its participants; others are added from the same
  picker.
- Participants are picked from the agency staff and, on a task that belongs to a project, from
  the client's people who reach that project. A client's person named on a task sees it only when
  it is marked visible to the client, as every customer of the project already does.
- A manager or guest sees the tasks they take part in and the tasks nobody takes part in that
  they created; being named grants no right to change a task.
- Cards on the board, in the calendar and in a project's work in flight show who takes part.
- The task module's responsible-member filter becomes a participant filter; the project filter
  sits beside it. Both are remembered per member.
- A manager may list the people of a client — `GET /api/members?clientId=`, optionally narrowed
  to one project with `projectId` — so the participants picker can offer them. Until now only an
  admin and the client's principal could; the manager sees the same contact details an admin does.

## Capabilities

### New Capabilities

### Modified Capabilities
- `task-board`: participants instead of a responsible member, who sees a task, what the task form
  offers, who takes part on cards, and the participant and project filters.
- `task-calendar`: the participants on calendar cards.
- `organization-membership`: a manager lists the people of a client, optionally narrowed to one
  project.
- `contact-directory`: the place a person is chosen for a task is the participants picker.

## Impact

- `apps/api/prisma/models/`: the `TaskParticipant` join and a data migration naming each task's
  former responsible member as a participant. The `assignee_id` column stays, unread and
  unwritten, so the version still running during a deploy keeps working; a later change drops it.
  A `kind` column added and dropped again while calls were considered goes in two migrations that
  cancel out.
- `apps/api/src/modules/tasks/`: create and update take `participantIds`, no longer `assigneeId`;
  validation of who may be named; the visibility rule.
- `apps/api/src/modules/realtime/application/task-event-delivery.ts`: participants receive live
  updates; `task.deleted` carries `participantIds` instead of `assigneeId`.
- `apps/api/src/modules/members/`: listing a client's people is open to managers and accepts
  `projectId`.
- `apps/web/src/entities/task/`, `apps/web/src/features/task-management/`,
  `apps/web/src/widgets/task-board/`, `apps/web/src/widgets/task-calendar/`,
  `apps/web/src/widgets/task-list/`, `apps/web/src/pages/tasks/`, `apps/web/src/pages/project/`:
  the task type, the form, the cards and the filters.
- `apps/web/src/shared/config/ru.ts`: the new copy.
- CRM leads keep their own responsible member; nothing about them changes.
