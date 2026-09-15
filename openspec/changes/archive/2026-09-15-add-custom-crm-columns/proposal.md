## Why

The eight fixed CRM stages describe a generic sales process, but agencies and their clients each track leads their own way. Five of the stages go unused, and the ones people need, such as "Целевой" or their own later steps, cannot be added.

## What Changes

- **BREAKING** (internal API): the fixed stages become four, in this order: Новый (`NEW`), Квалифицированный (`QUALIFIED`), Целевой (`TARGET`), КП (`PROPOSAL`). `CONTACTED`, `NEGOTIATION`, `WON`, `LOST` and `DEFERRED` are removed.
- Existing leads in removed stages move to Новый, after the leads already there, keeping their relative order. Leads in Предложение land in КП.
- Each board (the agency's and every client's) can add its own columns after the fixed ones. A dashed placeholder column with "+" at the end of the board creates one.
- Custom columns can be renamed, moved left or right among custom columns, and deleted. Deleting one moves its leads to the end of Новый, after a confirmation that says how many leads will move.
- Leads move freely between fixed and custom columns; the lead form offers every column of its board. Meta imports still land in Новый.
- Everyone who may manage leads on a board may manage its columns; guests only read. Column changes are audited and reach open boards in realtime.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `lead-crm`: four fixed stages and custom board columns replace the eight fixed stages; ordering, board display, audit and realtime cover columns.
- `access-control`: CRM write permissions include managing a board's columns.

## Impact

- Prisma: the `lead_stage` enum is rebuilt with four values, a new `lead_column` table is added, and `lead.column_id` is added with a stage-or-column check. The migration moves leads out of removed stages and keeps every lead.
- Backend: leads module column repository and use cases, lead create/update/move accepting a custom column id as `stage`, routes, OpenAPI, audit, realtime.
- Frontend: CRM board renders fixed and custom columns plus the placeholder, a column name dialog, a column menu, the lead form stage select, ordering helpers and Russian copy.
- Web app is the only API consumer; the removed stage values are updated there in the same change.
