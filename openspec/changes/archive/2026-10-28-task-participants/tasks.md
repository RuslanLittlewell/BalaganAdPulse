## 1. Participants in the data model

- [x] 1.1 Add the `TaskParticipant` join (`taskId`, `membershipId`, unique together, cascading on both sides, indexed on `membershipId`) to `apps/api/prisma/models/`, and generate the migration.
- [x] 1.2 Carry `participantIds` through `TaskRecord`, `NewTask` and `TaskChange`, the repository's `toDomain`, `create` and `update`, with the list replaced in the task's transaction.
- [x] 1.3 Add the data migration naming each task's `assignee_id` as a participant, and confirm locally that tasks given to somebody carry them.
- [x] 1.4 Remove `assigneeId` from `TaskRecord`, `NewTask`, `TaskChange`, the repository mapping, the task schemas, the OpenAPI description and the task events; leave the Prisma column unread and unwritten.
- [x] 1.5 Drop the `kind` column added while calls were considered, by a migration of its own, and remove it from the model and the API.

## 2. Rules for participants

- [x] 2.1 Accept `participantIds` on create and update in `task-schemas.ts` and the OpenAPI description.
- [x] 2.2 Extend `MemberReach` with a lookup returning, for a set of memberships, whether each is in the organization, active and a customer, and whether each reaches a given project through `ClientAccess`.
- [x] 2.3 In the use cases, refuse a customer naming participants (403); refuse duplicates, foreign members, newly named suspended members, customers anywhere but a task on a project they reach (400), including when an update only moves a task.
- [x] 2.4 Open `GET /api/members?clientId=` to managers and accept `projectId`, returning only the members whose grants reach that project; cover a manager listing a client's people, the project narrowing, and a guest refused.
- [x] 2.5 Cover the API: a list left alone, replaced and emptied, every refusal above, a suspended member kept, a guest named but refused an edit, a removed member leaving every list, a stale `assigneeId` ignored, the data migration's carried-over participant.

## 3. Who sees a task

- [x] 3.1 Rewrite `visibleTo` for staff: a project task on a granted project they take part in, or that nobody takes part in and they created; a task with no project they created or take part in.
- [x] 3.2 Rewrite `sees` in the task-event delivery the same way; `task.deleted` carries `participantIds` and no longer `assigneeId`.
- [x] 3.3 Rewrite the API tests that relied on a responsible member in terms of participants, and cover: each participant sees a task on the board, by id and in the project; one taken off gets 404; one without a grant does not see it; a customer named on an unmarked task gets 404; a task nobody takes part in is its creator's and the admins'.
- [x] 3.4 Cover the delivery: a task's events reach its participants and no other manager; an event of a task nobody takes part in reaches its creator; `task.deleted` reaches a participant.
- [x] 3.5 Run `npm test` until green.

## 4. Participants in the interface

- [x] 4.1 Remove `assigneeId` from the web task type and every reader, and the call kind, its mark, its button and its filter; add `participantIds` and the copy for Участники, Без участников and the picker note to `ru.ts`.
- [x] 4.2 Replace the responsible picker in `Назначить` with one Участники picker offering staff and, on a task with a project, the customers who reach it; start a new task with the creator among the participants (and the member the project page opens it for); drop customers who no longer reach a changed project; clear the list when the block is removed; count it in `filledBlocks`.
- [x] 4.3 Show who takes part on board, project and full-size calendar cards — up to three pictures named by their members and a count of the rest, or a note when nobody does — and list the participants in the compact calendar tooltip and the read-only task view.
- [x] 4.4 Replace the responsible-member filter with the participant filter (Без участников for tasks nobody takes part in), remembered per user under its own key, before the project filter.
- [x] 4.5 Cover the web: the picker's offers with and without a project, the creator named from the start, removing `Назначить` clearing the list, the participants on board, project list and calendar cards, the participant and project filters combining and surviving a remount.
- [x] 4.6 Describe participants and the filters in the README's task board section.
- [x] 4.7 Run `npm run test:web` until green; `openspec validate task-participants --strict`.
