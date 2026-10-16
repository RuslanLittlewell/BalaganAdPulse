## Why

Lead import starts on for every new Meta connection, so leads flow into CRM even where nobody
has set up access in Meta yet, and the switch is offered to organizations that have no CRM
at all. People also do not know what Meta needs before leads can be read.

## What Changes

- **BREAKING** for new connections: lead import is off by default — in the connection window,
  in the API when the field is omitted, and in the database. Existing connections keep their
  setting.
- The switch is shown only when the organization has the CRM module.
- An "i" button beside the switch opens instructions for what to set up in Meta for leads to
  arrive through the API.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `meta-lead-import`: lead import is opt-in, offered only with CRM, and explained in place.

## Impact

- API: integration use case default, Prisma default and its migration.
- Web: `features/meta-integration` connection window; copy in `ru.ts`.
