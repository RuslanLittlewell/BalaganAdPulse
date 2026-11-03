## Why

Staff build and edit a report on a page that stretches across the whole content area, so on a
wide screen the figures, charts and texts spread out and the report reads less like the
document the client receives. The edit controls are text links placed inside the flow of each
block ("Исправить заявки" after the change hint, "Изменить" under a figure or beside a title),
so they shift the block's content and look different from block to block.

## What Changes

- The report page takes 70% of the content width on large screens, centred, and the full width
  below that breakpoint.
- "Исправить заявки" on the leads card and "Изменить" on the hand-entered contacts card, the
  conclusions and the plan become a pencil icon button pinned to the block's top right corner.
  Each keeps its accessible name, so screen readers and tests still find it by the same words.

## Capabilities

### New Capabilities

### Modified Capabilities

No spec describes the report page's width or the look of its edit controls, so no requirement
changes; the change sets `skip_specs`.

## Impact

- Web: `pages/reports/ReportsPage.tsx` (report view width), `widgets/monthly-report`
  (`MonthlyReport.tsx`, `ContactsFigure.tsx`, `ReportText.tsx`).
- No API, data or copy changes.
