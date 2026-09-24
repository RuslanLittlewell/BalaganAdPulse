## 1. A new lead is placed first, not last

- [x] 1.1 Write and observe failing API tests: creating a second and third lead in a stage
  puts each new one first (`position` 0) and pushes earlier leads back, on both the agency and
  a client board.
- [x] 1.2 In `lead-use-cases.ts`'s `create()`, write the new row and then reuse `ordered()`
  with `[newRow, ...existingRowsOfThatStage]` so the new lead lands at position 0 and the rest
  shift back, mirroring how `move()` already reorders a stage.
- [x] 1.3 Run `npm test` until green.

## 2. An imported batch is placed first, not last

- [x] 2.1 Update the failing `lead.intake.test.ts` scenario that currently asserts imported
  leads land last in `Новый`, to assert they land first, ahead of leads already there, in the
  batch's own order; add a case for one poll importing several leads at once.
- [x] 2.2 Add `shiftNew(context, orgId, clientId, by)` to `LeadIntakeRepository` and
  `PrismaLeadIntakeRepository`, doing one bulk `UPDATE lead SET position = position + $by
  WHERE org_id = $1 AND client_id = $2 AND stage = 'NEW'`. Remove `countNew`, which becomes
  unused.
- [x] 2.3 In `lead-intake.ts`'s `deliver()`, claim every lead first, call `shiftNew` once with
  the claimed count, then create the claimed leads at positions `0..n-1` in delivery order.
- [x] 2.4 Run `npm test` until green.

## 3. Existing boards are reordered once

- [x] 3.1 Write and observe a failing isolated migration test (matching the pattern in
  `client-reach.migration.test.ts`): a scratch schema with a minimal `lead` table
  (`id`, `org_id`, `client_id`, `stage`, `column_id`, `created_at`, `position`), seeded with
  leads out of creation order across two boards and both a fixed stage and a custom column,
  asserting the migration leaves each `(org_id, client_id, stage-or-column_id)` group numbered
  0.. by `created_at` descending and touches no other column.
- [x] 3.2 Add the migration `reorder_leads_newest_first` with the `ROW_NUMBER() OVER
  (PARTITION BY org_id, client_id, COALESCE(stage::text, column_id) ORDER BY created_at DESC,
  id)` update described in `design.md`.
- [x] 3.3 Run `npm test` until green.

## 4. The CRM calendar shows leads by the day they arrived

- [x] 4.1 Write and observe failing web tests for a new `widgets/crm-calendar` (mirroring
  `widgets/task-calendar/TaskCalendar.test.tsx`'s structure): seven day columns Monday to
  Sunday, the week label, marking today, previous/next/today navigation, a lead shown in its
  arrival day (imported lead by `metaSource.submittedAt`, hand-made lead by `createdAt`),
  earliest-arrival-first ordering within a day, an empty day still drawn, and no drag handle
  or droppable affordance on any card.
- [x] 4.2 Build `CrmCalendar` in `widgets/crm-calendar`, reusing `startOfWeek`, `weekDays`,
  `shiftWeek`, `weekLabel`, `dayTitle`, `weekdayName`, `dayAndMonth` from
  `@/widgets/task-calendar/week.js` and `LeadCard` from `@/widgets/crm-board/LeadCard.js` (the
  same cross-widget reuse `CalendarDay.tsx` already does for `TaskCard`), fetching leads with
  the board's own `useLeads(boardKey)`.
- [x] 4.3 Add a `leadsOfDay` helper (arrival-day filter and earliest-first sort) colocated with
  the widget, covered by the tests from 4.1.
- [x] 4.4 Run `npm run test:web` until green.

## 5. The CRM screen offers the board and the calendar

- [x] 5.1 Write and observe failing web tests: `Канбан`/`Календарь` tabs appear beside the
  board selector, switching tabs swaps the view, the choice is remembered per person across a
  reload, a person who never chose sees the board, another person on the same browser gets
  their own remembered view (or the board), and switching boards while on the calendar keeps
  the calendar shown for the new board.
- [x] 5.2 Add `crmViews: ByUser` and `rememberCrmView` to `useModuleMemory`, matching the
  existing `taskViews`/`rememberTaskView` shape.
- [x] 5.3 Add the `Tabs`/`TabsList`/`TabsTrigger` switcher to `CrmPage`, matching `TasksPage`'s
  placement and `FadeContent` transition, rendering `CrmCalendar` in place of `CrmBoard` on the
  calendar tab.
- [x] 5.4 Add `crm.view.board`, `crm.view.calendar`, `crm.calendar.previousWeek`,
  `crm.calendar.nextWeek` and `crm.calendar.today` to `ru.ts`, reached through `t("key")`.
- [x] 5.5 Run `npm run test:web` until green.

## 6. Close the change

- [x] 6.1 Run `openspec validate show-newest-leads-first-and-by-day --strict` and confirm the
  implementation matches every scenario in the delta specs.
- [x] 6.2 Run the full `npm test` and `npm run test:web` one more time from a clean state.
