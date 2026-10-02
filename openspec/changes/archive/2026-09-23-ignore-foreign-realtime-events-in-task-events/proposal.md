## Why

`useTaskEvents` and `useCrmEvents` both connect to the same `/api/realtime`
socket, which carries more than one event family (`task.*` and
`crm.changed`, at least). `useCrmEvents` already discriminates by `kind`
before acting on a message; `useTaskEvents` does not — it treats every
non-`"ready"` message as a `TaskEvent` and reads `event.task` off it
unconditionally. A `crm.changed` message (or any other non-task kind)
reaching a page with `useTaskEvents` mounted throws
`Cannot read properties of undefined (reading 'projectId')` inside
`matchesFilter`, crashing that message handler.

## What Changes

- `useTaskEvents` ignores any message whose `kind` is not one of
  `task.created`/`task.updated`/`task.moved`/`task.deleted`, mirroring the
  guard `useCrmEvents` already has for its own event kind.
- No behavior change for actual task events; this only stops foreign events
  on the shared socket from being misread as task events. `skip_specs: true`
  — the realtime-board-sync spec already assumes a valid task event reaches
  the client; this restores that, it does not change what's specified.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
(none — bug fix, not a requirement change)

## Impact

- Frontend only: `apps/web/src/entities/task/api/useTaskEvents.ts`, plus its
  test `apps/web/test/entities/task/useTaskEvents.test.tsx`.
