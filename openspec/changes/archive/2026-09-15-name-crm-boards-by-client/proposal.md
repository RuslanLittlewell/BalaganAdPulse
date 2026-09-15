## Why

The CRM board selector names a client board by the client's organization and falls back to the contact name. Members know clients by the name shown in the contact book and on projects, so an organization name in the selector hides which client a board belongs to.

## What Changes

- Client boards in the board list are named by the client's name, whether or not the client has an organization.
- Boards stay ordered by client name, with Агентство first.

## Capabilities

### New Capabilities

### Modified Capabilities
- `lead-crm`: the board selector names client boards by client name instead of organization.

## Impact

- `GET /api/crm/boards`: `label` of a client board becomes the client name.
- Leads module board repository; no web or schema changes.
