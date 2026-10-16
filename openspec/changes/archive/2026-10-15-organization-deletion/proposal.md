## Why

The platform administrator can add, edit and suspend organizations but cannot remove one
that was added by mistake or has left for good. The row actions are also worded buttons
that crowd the table, and an organization's status is only readable from a badge.

## What Changes

- Add `DELETE /api/platform/organizations/:id`: deletes the organization with everything it
  holds, and the accounts of its people that belong to no other organization. Irreversible.
- The web app asks for the organization's name to be typed before it deletes.
- Row actions become icon buttons — pencil (edit), power (suspend or reactivate), trash
  (delete) — each with an accessible name and a tooltip.
- Each row carries a coloured left edge: green for an active organization, red for a
  suspended one.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform-administration`: the platform administrator can delete an organization.

## Impact

- API: `platform` module (use case, registry, HTTP, OpenAPI).
- Web: `organization-admin` feature (actions, delete dialog), `organization-table` widget.
- No schema change: every relation to an organization or a membership already cascades or
  nulls out.
