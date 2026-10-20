## Context

A task's schedule is a due date, an optional time and end, and a repetition interval. A
repeating task is one row whose due date moves forward when it is completed; nothing stores
its future occurrences. The task calendar draws each task on its due date only, on an hour
grid that starts at 06:00 and wraps past midnight. Task images are uploaded on their own and
belong to a task through the description: saving a description that names an image claims it
for the task.

## Goals / Non-Goals

**Goals:**

- Mark a call on the task itself, so it keeps everything a task has (participants, project,
  description, checklist, completion).
- Show calls as recurring events without storing occurrences.

**Non-Goals:**

- Moving one occurrence of a call. A call is moved as a whole, from the task form or from its
  card on its due day.
- Attaching files other than images. Images are what the attachments hold today; other files
  would need their own storage and preview.
- The CRM calendar. It has no hour grid, so there is no time of day to mark.

## Decisions

**`isCall` belongs to the schedule.** The rule "a call has a time and a repetition" is a
schedule rule, so `isCall` joins `TaskSchedule` and `rescheduled` decides it: an explicit
`isCall` in the change is kept as given and then checked, an inherited one survives only while
the schedule still has a time and a repetition. So a request saying "make it a call" without
the schedule for it is refused, while dropping the repetition of a call quietly ends the call
instead of failing the edit. The alternative, refusing any change that leaves a call without
its schedule, would make the form and the calendar send `isCall: false` alongside every edit
of the time.

**The call mark is a switch.** It sits under the repetition in the dates block, in the same
`Switch` the form uses for **Видно клиенту**, and is offered whether the task is being created
or edited.

**Occurrences are computed on the client, per week shown.** `occurrencesBetween(task, from,
to)` in `entities/task` walks from the due date by `nextOccurrence`, the same step the server
uses on completion, until the week is passed. The calendar asks for one week at a time, so
the walk is short; a daily call started a year ago is a few hundred steps. Storing occurrences
or expanding them on the server would add a model for what is a pure function of three
fields.

**Calls are split off on the page.** The tasks page divides the filtered tasks into work and
calls: the board and the calendar get the work, the calls view gets the calls, whatever their
stage, since a call is not board work and its stage means nothing once it is off the board. The
filters still list participants and projects from all tasks, so a person who only has calls can
be chosen.

**One calendar component.** `TaskCalendar` draws each task on its due day, and a call also on
every later day `occurrencesBetween` finds in the week. The calls view is that component handed
only the calls, so it needs no mode of its own. Only the card on the due day is the task's real
position: it keeps dragging, which moves the series. The cards on the other days open the task
on click and are not dragged, because dragging an occurrence would have to move the whole series
by an offset, which reads as moving one meeting while moving all of them. No call card offers
the done tick: completing a call would only move its due date and hide the occurrences before
it, which in a calendar of meetings reads as the meeting vanishing.

**The now line is drawn in today's column, ticking each minute.** A `useNow` hook re-renders
every 30 seconds; the line sits at `topOfTime(HH:mm)`, so it follows the same 06:00 start and
wrap as the cards. It is drawn in `--primary`, which is the green of the light theme and the
gold of the dark one. It carries the time in `data-now` and is otherwise decorative.

**The paperclip uploads in the attachments, the editor only inserts.** `TaskAttachments`
renders the paperclip when given `onAttach`, checks each chosen file against the limits,
uploads it and hands the id up; the form inserts it at the end of the description through the
editor's handle. The upload limits move to `entities/task` so the editor's paste path and the
paperclip share them. Uploading in the editor and reporting there would put the progress and
the errors away from the button that started them.

## Risks / Trade-offs

- [A call is moved to another stage from its form and nothing shows it] → The calls view shows
  calls in every stage, so the stage cannot hide one. A call ends by being deleted, or by
  switching off `Созвон`, after which it is an ordinary task on the board.
- [Many calls make the walk longer] → Bounded by the week shown; a monthly walk is twelve
  steps a year.

## Migration Plan

One migration adds `task.is_call BOOLEAN NOT NULL DEFAULT false`. Rolling back the code leaves
an unused column; dropping it loses only the marks.
