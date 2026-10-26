## Why

An existing task's description opens as a read view, and the only way into editing it is
the small «Изменить» button beside its label. Members click the text they want to change,
as they would in any document, and nothing happens.

## What Changes

- Clicking the read view of an existing task's description, its text or the space around
  it, makes the description editable with the caret where the click landed.
- A click on a link in the description still opens the link, a click on an attachment still
  opens its preview, and finishing a text selection still leaves the description for reading.
- The «Изменить» and «Готово» button keeps working as before.

## Capabilities

### New Capabilities

### Modified Capabilities
- `task-description-view`: the read view of a description becomes editable on a click.

## Impact

- `apps/web/src/features/task-management/ui/TaskDescriptionEditor.tsx`: asks its parent to
  edit when its read view is clicked, and puts the caret where the click landed.
- `apps/web/src/features/task-management/ui/TaskFormDialog.tsx`: turns editing on from that
  request.
- The read-only preview for members who may not edit tasks is unchanged.
- No API or schema change.
