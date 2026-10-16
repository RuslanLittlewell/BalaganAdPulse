## Context

A task stores `dueDate` (a `DATE`) and `dueTime` (`VARCHAR(5)`, `HH:MM`, the agency's wall clock).
`domain/schedule.ts` owns how a change applies to the schedule (`rescheduled`) and what a valid
time is (`isTimeOfDay`); the use cases refuse a time without a day and repetition without a day.
Completing a repeating task changes only `dueDate`.

The calendar (`widgets/task-calendar/TaskCalendar.tsx`) places a timed card absolutely in its day
column at `topOfTime(dueTime)` with a fixed `EVENT_HEIGHT` of 76px and the full column width, so
cards at the same hour cover each other. The hour height is 56px at the default scale and smaller
when zoomed out; below 40px an hour cards switch to a one-line compact form. Dragging computes the
new `dueTime` from the drop position, snapped to 15 minutes, and sends `dueDate` and `dueTime`.

## Goals / Non-Goals

**Goals:**
- One place that decides how a schedule changes, so the API, the form and the calendar agree on
  lengths and the end of the day.
- A layout that is a pure function of a day's tasks, testable without rendering.

**Non-Goals:**
- Resizing a card by dragging its edge. The end is set in the form.
- Tasks spanning midnight or several days.
- A default length other than one hour, or a per-member one.

## Decisions

- **Store the end as a time, not a duration.** `end_time VARCHAR(5)`, like `due_time`, reads the
  same in the API, the form and the database, and needs no arithmetic to display. A duration would
  make "until 18:00" depend on the start and would have to be recomputed for display everywhere.
- **24:00 is a valid end and nothing else is past 23:59.** An end must be expressible for a task
  running to the bottom of the grid; `isEndOfDay` accepts `HH:MM` up to `23:59` plus `24:00`, which
  only an end may hold. Comparisons work on minutes since midnight, where `24:00` is 1440.
- **The length is kept in `rescheduled`.** When a change names a new start and no end while the
  task has one, the end becomes the new start plus the old length; clearing the start or the day
  clears the end. Putting this in the domain function means the calendar's existing reschedule
  request — day and start only — keeps the length with no new endpoint, and the API refuses the
  same impossible end the calendar avoids. The form always sends start and end together, so it
  never relies on the default.
- **The calendar clamps before it sends.** On a drop the calendar computes the start from the
  pointer, then pulls it back to `1440 − length` if the end would pass the day, so the request it
  sends is always valid and the card is drawn where it will stay.
- **Overlap layout is a pure function in `week.ts`.** Given a day's timed tasks it returns, for
  each, its top, its height and its horizontal slot (`lane`, `lanes`). Tasks are sorted by start,
  then by longer first; they are swept into clusters of transitively overlapping ranges, half-open
  so back-to-back tasks do not overlap; inside a cluster each task takes the lowest lane whose last
  task has ended, and every task in the cluster gets the cluster's lane count. This is the layout
  common calendars use: stable, never covers a card, and keeps short gaps narrow. Width follows
  `1 / lanes`; a minimum drawn height keeps a 15-minute card clickable.
- **The default hour grows from 56px to 80px.** A full card needs about 76px. Drawn to its
  length, an hour-long task at 56px would always fall back to the one-line card, so the largest
  scale is raised until an hour holds a full card; zooming out still reaches the whole day.
- **The grid's six o'clock start is kept.** The grid shows 06:00 first and the small hours last,
  so the end of a day is the midnight line, not the bottom; a task crossing 06:00 is cut at the
  bottom rather than wrapped to the top.
- **Compact is decided per card.** A card is compact when its drawn height is below the current
  compact threshold, rather than when the hour is, so a short call is one line at any scale while
  its long neighbour keeps its full card.
- **The form's dates block gains Окончание after Начало, both time fields.** The end field appears
  once a start is set; clearing the start clears it. Changing the start in the form moves the end
  with it, so the member edits the length by editing the end. A browser time field cannot hold
  `24:00`, so `00:00` in the end field stands for midnight: an end of `24:00` is shown as `00:00`
  and `00:00` entered there is stored as `24:00`, which is unambiguous because an end must come
  after the start. An end before the start is pointed out under the field before saving, so the
  API's English refusal is never what the member reads.

## Risks / Trade-offs

- [Narrow cards on a day with many overlaps are hard to read] → compact cards already carry a
  tooltip with the full details; a very crowded hour stays usable through it.
- [A request moving only the start of a task near midnight is refused] → the calendar never sends
  one, and the error names the cause; the form sends both times.
- [`24:00` as a value surprises a reader of the database] → it appears only in `end_time`, and the
  validation and README describe it.

## Migration Plan

One additive migration adding the nullable `task.end_time`. Every existing task reads back with no
end and is drawn one hour long, which is shorter than today's 76px cards at the default scale, but
no data changes. The running version ignores the column, so the README's deploy order holds.
