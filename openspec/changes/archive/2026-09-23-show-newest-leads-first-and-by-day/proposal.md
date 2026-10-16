## Why

Two independent requests from the media buyer using the CRM. First, a board's columns
currently list leads in whatever order they were dragged into, with a freshly created or
imported lead landing at the bottom — the opposite of what someone scanning for what just
came in wants. Second, the CRM has no sense of time at all: there is no way to see how leads
are spread across the days they arrived, the way the tasks screen already lets a member see
tasks spread across a week.

## What Changes

- A newly created or imported lead is placed first (position 0) in its stage or column,
  pushing existing leads down, instead of appended last. This is a visible ordering change on
  every board, applied going forward.
- **BREAKING** A one-time data migration reorders every existing lead within its board and
  stage/column by creation time, newest first, so historical boards match the new rule
  immediately rather than only for leads created after the release.
- The CRM screen gains a second view, `Календарь`, chosen from a tab list next to the
  existing board — mirroring the tasks screen's `Канбан`/`Календарь` tabs, the same week
  navigation (previous week, next week, today) and the same seven-day, Monday-to-Sunday
  layout. Unlike the tasks calendar, lead cards are not draggable between days: a lead's day
  is the day it arrived, not a schedule a member sets.
- A lead appears on the calendar day it arrived: an imported lead on the day of its form
  submission, a hand-made lead on the day it was created — the same "arrival" already used by
  the CRM's period lead counts. Within a day, leads are shown oldest-arrival-first, since a
  day column reads as a log of that day rather than a queue to work through.
- The chosen view (board or calendar) is remembered per person per browser, like the tasks
  screen's view choice.

## Capabilities

### New Capabilities
- `lead-calendar`: a second, read-only view of a CRM board's leads grouped by the day they
  arrived, with week navigation.

### Modified Capabilities
- `lead-crm`: creation places a lead first in its stage or column instead of last, and a
  one-time migration reorders existing leads to match.
- `meta-lead-import`: an imported batch lands first in `Новый` on the client's board instead
  of last.

## Impact

- **API**: `PrismaLeadRepository.create` and the Meta lead intake path insert at position 0
  and shift the rest of the stage/column down by one, instead of appending. One new Prisma
  migration renumbers existing `lead.position` values per `(org, board, stage-or-column)`
  group by `created_at` descending; no rows are added or removed and no other column changes.
- **Web**: `CrmPage` gains a `Tabs` switcher and a new `crm-calendar` widget that reuses
  `LeadCard` from `crm-board` and the week-navigation date helpers already used by
  `task-calendar`. `useModuleMemory` gains a per-person remembered CRM view, alongside the
  existing remembered board.
- **Dependencies**: none added.
