## 1. Hints

- [x] 1.1 Reword the header hint to "Добавить клиентов и сотрудников" and update its tests.
- [x] 1.2 Lift `Hint` above dialogs; add the `contacts.firstClient` hint on the add-client button of `ClientDirectory`, for those who may create a client, while the list is empty and no client is being created.
- [x] 1.3 Cover the add-client hint: shown on an empty list to an admin and a manager, not with clients, not to a guest, hidden while creating, closed for good without touching the header hint; run `npm run test:web` until green.

## 2. Close

- [x] 2.1 Run `openspec validate contact-book-hints --strict` and `npm run test:web`, then archive the change.
