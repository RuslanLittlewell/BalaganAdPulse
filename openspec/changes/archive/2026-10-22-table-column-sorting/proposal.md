## Why

Media buyers scan tables for the biggest spend, the worst cost per lead or the newest
organization, and today every table shows rows in one fixed order. Finding an outlier
means reading the whole table.

## What Changes

- Every column of the performance tables, the organizations table and the reports list can
  be sorted ascending and descending by choosing its header.
- The first choice of a header shows the largest values first; choosing the same header
  again flips the direction, and a third time returns the table to its original order.
- The performance tables sort the rows within each level, so campaigns stay under their
  project, ad sets under their campaign and ads under their ad set.
- Rows with no value for the sorted column always come last.
- Columns that only hold controls, such as row actions, are not sortable.

## Capabilities

### New Capabilities
- `table-sorting`: sorting a table by any of its data columns in both directions.

### Modified Capabilities

## Impact

- `apps/web/src/shared/lib`, `apps/web/src/shared/ui`, `apps/web/src/shared/config/ru.ts`.
- `apps/web/src/widgets/performance-table`, `apps/web/src/widgets/organization-table`,
  `apps/web/src/pages/reports/ReportsPage.tsx`.
- No API change.
