## Why

An agency created a report for a client and the client did not find it in their cabinet: the
report was a draft, and nothing told the agency that a client sees a report only once it is
published. The client's list is also a table of figures, where a client looks for a file per
month.

## What Changes

- Staff are told, on a draft's page and under a report list that holds drafts, that the
  client does not see a draft until it is published. Publishing stays the only way a report
  reaches the client.
- A customer sees the Reports module as a set of files: one tile per published report with a
  white file icon, labelled with the report's month and year and its project, newest first,
  each opening the report. Staff and guests keep the table.

## Capabilities

### New Capabilities

### Modified Capabilities
- `monthly-reports`: how a customer's report list looks, and what staff are told about drafts.
  The capability's requirements are still in the unarchived `monthly-reports` change, so this
  change adds its rules as new requirements beside them.

## Impact

- Web: `pages/reports` list, `widgets/monthly-report` staff bar, Russian copy in `ru.ts`.
- No API or data changes: the API already lists only published reports to customers.
