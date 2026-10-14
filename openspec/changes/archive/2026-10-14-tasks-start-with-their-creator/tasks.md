## 1. The creator sees an unassigned project task

- [x] 1.1 Widen `visibleTo` in the task repository: a staff member also sees a project task on a granted project that they created and nobody is responsible for.
- [x] 1.2 Widen `sees` in the task-event delivery the same way.
- [x] 1.3 Cover the API: a manager creates an unassigned project task and lists it, reads it by id, sees it in the project filter; a colleague does not; once an admin assigns it to the colleague it leaves the creator.
- [x] 1.4 Cover the delivery: an unassigned project task's events reach its creator and no other manager; an assigned one's do not reach its creator.
- [x] 1.5 Run `npm test` until green.

## 2. A new task starts with its creator responsible

- [x] 2.1 In the task form, when creating a task without a given responsible member, choose the viewer's own active membership from the picker's staff list while the field is untouched.
- [x] 2.2 Cover the form: the task module's create form opens with `Назначить` shown and the viewer chosen; saving untouched stores them; a given responsible member wins; a viewer not in the picker starts bare.
- [x] 2.3 Run `npm run test:web` until green; `openspec validate tasks-start-with-their-creator --strict`.
