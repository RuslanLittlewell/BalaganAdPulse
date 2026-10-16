## Why

The campaign tabs open on Все, which mixes the accounts the tabs exist to separate. The
agency wants the tabs to list the integrations only.

## What Changes

- The Все tab is removed; the tabs list one per account, and the first is chosen.
- With several accounts the table therefore always shows one account, without a totals row.
- Tabs are sized to their names.

## Capabilities

### New Capabilities

### Modified Capabilities
- `meta-project-integration`: the campaign tabs drop Все.

## Impact

- `apps/web/src/pages/project/ProjectPage.tsx`, its tests and `ru.ts`. No API change.
