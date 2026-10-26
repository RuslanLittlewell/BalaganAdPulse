## 1. Click to edit the description

- [x] 1.1 Give `TaskDescriptionEditor` an `onEdit` callback called on a click on its read view, skipping links, attachments and finished selections, and focus the clicked position once editable.
- [x] 1.2 Pass `onEdit` from `TaskFormDialog` to turn editing on.
- [x] 1.3 Cover the form dialog: a click on the text makes the description editable and the button read «Готово»; a click on an attachment opens its preview and leaves it read-only; the preview for members who may not edit stays read-only on a click.
- [x] 1.4 Run `npm run test:web` until green; `openspec validate task-description-click-to-edit --strict`.
