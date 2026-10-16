## Why

Creating or deleting a lead gives no confirmation: after Создать the card simply turns into a
stored lead, and after deleting it the card closes. A member cannot tell at a glance that the
action went through.

## What Changes

- Creating a lead raises a success alert Лид создан.
- Deleting a lead raises a success alert Лид удалён.
- Failures keep raising the error alerts they raise today.

## Capabilities

### Modified Capabilities
- `lead-crm`: a new requirement confirming create and delete.

## Impact

- **Web** (`apps/web`): `LeadCard.tsx`, its test, two strings in `ru.ts`.
