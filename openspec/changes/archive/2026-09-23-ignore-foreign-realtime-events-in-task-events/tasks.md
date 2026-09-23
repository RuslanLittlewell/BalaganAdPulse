## 1. Guard `useTaskEvents` against foreign event kinds

- [x] 1.1 Write and observe a failing test in
  `apps/web/test/entities/task/useTaskEvents.test.tsx`: delivering a
  `{ kind: "crm.changed", orgId: "org1", board: "b1" }` message (or any other
  non-task kind) through the socket does not throw and leaves the cached
  task list unchanged.
- [x] 1.2 In `apps/web/src/entities/task/api/useTaskEvents.ts`, ignore any
  message whose `kind` is not `task.created`/`task.updated`/`task.moved`/
  `task.deleted` before calling `apply`.
- [x] 1.3 Run `npm run test:web` until green. 133 files / 1102 tests.
