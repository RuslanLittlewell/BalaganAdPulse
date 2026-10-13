## Context

Which tasks a staff member sees is decided in two places that must agree: the Prisma
filter `visibleTo` in the task repository, which serves the board, the project's task
list and reading a task by id, and `sees` in the realtime task-event delivery, which
decides who receives live board updates. Both already let the creator of a task with no
project see it; for a project task both ask only whether the member is responsible.

The task form keeps its values in `react-hook-form` and opens the `Назначить` block
whenever the task carries a project or a responsible member. The project page already
opens the form with the viewer's own membership as `assigneeId`; the task module does not.

## Goals / Non-Goals

**Goals:**
- The creator of an unassigned project task sees it everywhere a responsible member
  would: board, project task list, by id, live updates.
- Every way of opening the create form starts with the creator responsible.

**Non-Goals:**
- Keeping a task on its creator's board after somebody else is made responsible; the
  existing "handed to somebody else" rule stays.
- Defaulting the responsible member in the API.
- Telling the creator's open boards that a task left them when it is reassigned; that
  gap exists today for every reassignment.

## Decisions

- **The creator sees a project task only while nobody is responsible.** The rule reads
  "responsible, or created it and nobody is responsible". Letting the creator see every
  task they ever created would undo the existing scenario in which a manager hands work
  to a colleague and it leaves their board. Tasks with no project keep their own,
  wider rule.
- **The same predicate in both places**, written once per side: a Prisma `OR` in the
  repository and a boolean in `sees`. They are short enough that sharing a helper across
  the infrastructure/application boundary would cost more than it saves; a test on each
  side pins them together.
- **The default responsible member lives in the form, not the API.** The API keeps
  storing what it is given, so scripts and tests that create unassigned tasks keep their
  meaning, and a customer creating through the API is never made responsible for agency
  work. The form finds the viewer's own membership in the staff list it already loads for
  the picker, so a customer, who is not in that list, starts with nobody.
- **The default is applied once the staff list arrives** if the form has not been
  touched, because the list may still be loading when the dialog opens. A caller that
  passes `assigneeId` (the project page) keeps precedence.

## Risks / Trade-offs

- [A form opened before the staff list loads shows nobody, then the creator] → the swap
  happens only while the field is untouched, so a choice the member made is never
  overwritten.
- [Creators may now see unassigned tasks they had forgotten] → that is the point of the
  change; admins already saw them.
