## Why

Setting up a new customer means leaving the project form, opening the contact book, creating the client and starting the project form again. In the contact book, the control that adds a client sits in the details header instead of where the projects list puts it, and long client names overflow the list.

## What Changes

- The contact book's client list offers a round "+" control at its bottom right, as the projects list does, to members who may create clients. It opens the new-contact form beside the list and replaces the "+" in the details header.
- Long client names in the contact book list are shortened with an ellipsis, with the full name shown on hover.
- The project form offers a "Новый клиент" icon beside the client select to members who may create clients. It opens the new-client form on top of the project form; the created client appears in the contact book and in the select and is selected in the project form.
- No API changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `contact-directory`: where clients are added in the contact book and how long names are listed.
- `project-management`: creating a client from the project form.

## Impact

- Frontend: `ContactBook` list column and control placement, `ProjectFormDialog` client field wired to the existing `ClientFormDialog`, Russian copy; tests for both.
- No backend, schema or API contract changes.
