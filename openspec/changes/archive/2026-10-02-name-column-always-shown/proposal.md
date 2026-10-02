## Why

Hiding the name column leaves rows of bare numbers that no one can tell apart, and the
agency wants campaigns always named in tables.

## What Changes

- The name column is always shown in every performance table and is no longer offered by
  the column chooser; saved choices that hid it get it back.
- The table's rendering for a missing name column is removed.

## Capabilities

### New Capabilities

### Modified Capabilities
- `performance-table-columns`: the name column is always shown.

## Impact

- `apps/web/src/widgets/performance-table/PerformanceTable.tsx`, `columnWidths.ts`, tests.
