## Context

A task row names one `assigneeId` and one `createdById`, both `Membership` ids. Which tasks a
member sees is decided in two places that must agree: `visibleTo` in
`prisma-task-repository.ts`, which serves the board, the calendar, a project's list of work in
flight and reading a task by id, and `sees` in `task-event-delivery.ts`, which decides who
receives live updates. Both reason about the responsible member and the creator.

The checklist already shows the shape a list owned by a task takes in this module: it is given
whole on create and update, replaced inside the same transaction, and returned with the task.

On the web, the task module's filters live in `TasksPage` and are kept per user in
`useModuleMemory`; the board and the calendar receive the already-narrowed list. The form keeps
its values in `react-hook-form`; which blocks are shown is computed in
`features/task-management/model/blocks.ts`. The staff list comes from `GET /members?kind=staff`;
a client's people from `GET /members?clientId=`, which only an admin or the client's principal
could read.

## Goals / Non-Goals

**Goals:**
- One notion of who a task belongs to — its participants — used by the API, the visibility rule,
  the live delivery, the filters and the cards.
- No task loses the person it was given to: the former responsible member becomes a participant.
- Calls need no model of their own: a task with a time of day that repeats is a call.
- A deploy that never breaks the version still running.

**Non-Goals:**
- Notifying people when they are named.
- A "lead" among the participants. If one is wanted later it is a flag on the join, not a second
  field.
- A separate kind for calls, a call mark or a filter for calls.
- Dropping the `assignee_id` column in this change.

## Decisions

- **Participants replace the responsible member everywhere.** Keeping a responsible member next
  to a list would have meant two answers to "whose work is this" — for the board, the filter and
  the card — and a hidden rule about which one wins. One list is what the agency described: who
  takes part sees the task.
- **No kind of task.** A `TaskKind` column was added while calls were considered as their own
  entity and is dropped again by a migration of its own rather than by rewriting the first, which
  had already been applied to development databases. Both run in one deploy and cancel out.
- **One `TaskParticipant` join.** (`taskId`, `membershipId`) as the primary key,
  both cascading on delete, indexed on `membershipId`. Cascading on `Membership` is what makes a
  removed member leave every list. The API exposes it as `participantIds`.
- **The former responsible member is carried over by a data migration.** `INSERT … SELECT id,
  assignee_id FROM task WHERE assignee_id IS NOT NULL ON CONFLICT DO NOTHING`. The column itself
  is left in place: the version running while the migration applies still reads it, and dropping
  it belongs to a later change once nothing does. New code neither reads nor writes it.
- **`assigneeId` leaves the task API.** It is dropped from the request schemas — unknown keys are
  stripped, so a stale client sending it is ignored rather than refused — and from the task
  record, the OpenAPI description and the realtime events. The web is the only client.
- **The visibility rule.** A staff member sees a project task on a granted project when they take
  part in it, or when nobody takes part in it and they created it; a task with no project when
  they created it or take part in it. Admins see everything; customers keep their rule. The same
  predicate is written once in `visibleTo` (a Prisma `OR` with `participants: { some }` and
  `participants: { none }`) and once in `sees`, pinned together by a test on each side.
- **The creator is named by the form, not the API.** The API stores what it is given, so a task
  created through it with nobody named is seen by its creator and admins, as an unassigned task
  was. The form starts with the creator among the participants whenever the picker offers them,
  and a customer, whom it does not offer, starts with nobody.
- **Validation in the use case, through the member port.** `MemberReach.describe` returns, for a
  set of membership ids, whether each is in the organization, active and a customer, and whether
  each reaches a given project through `ClientAccess`. The use case refuses duplicates, members
  outside the organization, newly named suspended members, and customers anywhere but a task on a
  project they reach; it checks again when an update moves a task to another project.
- **The picker reads the client's people from the members listing.** `GET /members?clientId=`
  is opened to managers, who already reach every client, and gains `projectId` so the picker never
  offers somebody the API would refuse. A dedicated endpoint returning names alone was considered;
  the existing listing was chosen, accepting that managers see the client's people's contact
  details.
- **Filters are pure helpers over the loaded board.** The participant filter keeps a task when
  any chosen member takes part in it, with Без участников for tasks nobody does; it replaces the
  responsible filter and its remembered choice starts empty. Order of narrowing: participants,
  then projects.
- **Cards show up to three participants and a count.** A shared `TaskParticipants` element draws
  the pictures with their names as accessible labels and tooltips, used by the board card, the
  calendar card and the project's work in flight; the compact calendar tooltip lists the names.

## Risks / Trade-offs

- [A task a manager created for a colleague leaves the manager's board] → as before; the creator
  keeps it by staying among the participants, which the form does by default.
- [Naming a staff member who does not reach the project hides the task from them] → reach stays
  the first gate, as it was for the responsible member.
- [Naming a client's person on an unmarked task changes nothing they can see] → only an admin
  decides what a customer is shown; the picker says so under the list.
- [The old responsible filter's remembered choice no longer applies] → the participant filter is
  remembered under its own key and starts empty; nothing breaks, the first visit shows everything.

## Migration Plan

Three migrations, all backward-compatible with the running version: the `task_participant`
table (with a `kind` column), the data migration copying each `assignee_id` into it, and the
removal of `kind`. The running version never reads the new table and still finds `assignee_id`
where it was. Rolling the code back leaves participants written by the new
version unseen by the old one, and the old one's responsible member as it was before the deploy.
