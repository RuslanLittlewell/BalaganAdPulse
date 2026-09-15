## Why

Moving between modules loses the member's place. The menu opens CRM on the default funnel and the projects module on its empty state, so a buyer who works one client's funnel and one project picks them again after every visit to another module.

## What Changes

- CRM reopens the funnel the signed-in person last selected in this browser when it is opened without a funnel in the address, as long as they can still reach it; otherwise it opens the default funnel as today.
- The projects module reopens the project or campaign the person last had open, with its reporting period, when it is opened without a project in the address, as long as the project is still reachable; otherwise it shows the unselected state as today.
- A funnel or place named in the address always wins and becomes the remembered one.
- What is remembered belongs to the signed-in person and survives reload; another person signing in on the same browser starts fresh.
- No API or schema changes.

## Capabilities

### New Capabilities
- `projects-module-memory`: returning to the projects module reopens the last project or campaign the person had open, with its period.

### Modified Capabilities
- `lead-crm`: the agency board selector opens the last selected reachable board instead of always defaulting to the agency board.

## Impact

- Frontend: a persisted per-person selection memory store in shared code; `CrmPage` and the projects module index route read and update it; tests for both.
- No backend, schema, API or dependency changes; zustand is already in use.
