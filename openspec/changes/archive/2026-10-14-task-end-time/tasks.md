## 1. The end in the schedule

- [x] 1.1 Add `Task.endTime` (`end_time VARCHAR(5)`, nullable) to `apps/api/prisma/models/` and generate the migration.
- [x] 1.2 In `domain/schedule.ts`, add `endTime` to the schedule, an end-of-day check accepting `24:00`, and in `rescheduled` keep the length when only the start moves, clear the end with the start or the day.
- [x] 1.3 Carry `endTime` through the task record, the repository, `task-schemas.ts` and the OpenAPI description; in the use cases refuse an end without a start, an end not after the start, and a kept length that passes the day.
- [x] 1.4 Cover the domain: keeping the length, clearing, `24:00`, the end of the day; cover the API: every scenario of the due-date requirement, including completion keeping both times.
- [x] 1.5 Run `npm test` until green.

## 2. The end in the form and on the card

- [x] 2.1 Add `endTime` to the web task type and API calls, and the copy for Начало and Окончание to `ru.ts`.
- [x] 2.2 In `TaskSchedule`, show Окончание once a start is set, move it with the start, clear it with the start; send both times on save.
- [x] 2.3 Show the end on `TaskCardView` and in the compact tooltip as `12:00–13:30`.
- [x] 2.4 Cover the form and the card: the end appearing and clearing, moving with the start, the range on the card.

## 3. The calendar

- [x] 3.1 Add to `week.ts` the pure layout of a day's timed tasks: top, height from the length or one hour, clipped to the day, and lane and lane count from the overlap clusters.
- [x] 3.2 Draw timed cards in `TaskCalendar` from that layout, with width and offset from the lane, and decide compact per card from its height.
- [x] 3.3 On a drop keep the length and pull the start back so the end stays within the day; draw the card there optimistically.
- [x] 3.4 Cover the layout: one task, the same hour, a chain of overlaps, back to back, no end, late in the day; cover the calendar: side-by-side cards both opening, a short call compact beside a full card, a drop keeping the length, a late drop clamped.
- [x] 3.5 Describe the end time, `24:00` and the side-by-side layout in the README's task board and calendar section.
- [x] 3.6 Run `npm run test:web` until green; `openspec validate task-end-time --strict`.
