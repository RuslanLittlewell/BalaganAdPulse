## Why

The first hint gets a person into the contact book, but once there an empty client list
still leaves them looking for the way to add one. The first hint's wording is also to name
clients before employees, as the contact book does.

## What Changes

- The header hint reads "Добавить клиентов и сотрудников".
- A second hint, "Создайте клиента", points at the contact book's add-client button while
  the organization has no clients, for whoever may create one.
- Hints stack above dialogs, so one can point at a control inside an open dialog.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `onboarding-hints`: the header hint's wording, and a hint on the add-client button.

## Impact

- Web only: `ru.ts`, `shared/ui/Hint`, `features/hints`, `widgets/contact-book/ClientDirectory`.
