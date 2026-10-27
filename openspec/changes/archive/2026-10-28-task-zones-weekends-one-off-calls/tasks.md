## 1. API

- [x] 1.1 Add `task.time_zone` (nullable) and `task.skip_weekends` (default false) to the Prisma model with a migration.
- [x] 1.2 Extend the schedule domain: a time zone and skip-weekends on the schedule, a call needing only a time, the weekday rules for completion and for a weekend due date.
- [x] 1.3 Accept `timeZone` (an IANA name) and `skipWeekends` on create and update; refuse an unknown zone and skipping weekends without a repetition; return both, resolving a missing zone to `TASK_TIME_ZONE`; document them in OpenAPI.
- [x] 1.4 Count the deadline reminder in the task's zone and widen the lookup by a day on each side; name the task's zone in a notification.
- [x] 1.5 Cover the zone, the call rule, skipping weekends and the reminder with API tests.

## 2. Web

- [x] 2.1 Convert tasks to the viewer's zone in `tasksApi` and the realtime handler, and send the viewer's zone with any day or time written.
- [x] 2.2 Count call occurrences in the task's zone, leave out weekends for a task that skips them, and draw each occurrence at its own local time.
- [x] 2.3 Task form: the `Созвон` switch with a time alone, the `Пропускать выходные` checkbox while repeating, and no day or time sent when they are unchanged.
- [x] 2.4 Mirror the weekday rule in the optimistic completion, and send a day-only reschedule with the task's time.
- [x] 2.6 Show a notification's deadline in the reader's zone.
- [x] 2.5 Cover the conversion, the occurrences, the form and the calls view with web tests.

## 3. Close

- [x] 3.1 Run the API and web suites and the type-checks until green; `openspec validate task-zones-weekends-one-off-calls --strict`.
