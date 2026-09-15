## Why

The project's Meta integration panel repeats what a buyer does not need to read on every visit: the schedule, a status line with the account and currency, and a lead import state whose healthy value, "загружаются", reads as work in progress that never finishes. The two timestamps are what tell a buyer the data is fresh.

## What Changes

- In its healthy state the panel shows its heading and only two lines under it: the time of the last successful advertising import and the time of the last successful lead poll.
- The schedule text, the synchronization status line with account and currency, and the lead import state line are removed.
- Failures stay visible: an expired token, an import error, missing lead access and a failed lead poll are still explained in Russian, but only while they apply.
- Progress stays visible through the refresh control, which shows activity and is disabled while an import is queued or running.
- No API changes: the connection read keeps exposing statuses for the interface to act on.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `meta-project-integration`: the panel no longer presents a standing synchronization status; progress is shown on the refresh control and failures only when they occur.
- `meta-lead-import`: the panel shows the time of the last successful lead poll and explains lead import only when it needs access or failed.

## Impact

- Frontend: `MetaIntegration` panel markup and its tests; unused Russian copy for the schedule and statuses leaves `ru.ts`.
- No backend, schema or API contract changes.
