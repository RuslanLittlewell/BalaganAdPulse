## 1. Hint

- [x] 1.1 Add the `projects.firstProject` hint on the add button of `ProjectList`, for those who may create a project, while the list is empty and no project is being created; copy in `ru.ts`.
- [x] 1.2 Cover it: shown on an empty list, not with a project, not to a guest, hidden while creating, closed for good on its own; run `npm run test:web` until green.

- [x] 1.3 Add the `projects.firstClient` hint on the add-client button of `ProjectFormDialog`, for those who may create a client, while there are no clients and no client is being created; copy in `ru.ts`.
- [x] 1.4 Cover it: shown with no clients, not with a client, not to someone who may not create clients, hidden while the client form is open, closed for good on its own; run `npm run test:web` until green.

## 2. Close

- [x] 2.1 Run `openspec validate project-creation-hint --strict` and `npm run test:web`, then archive the change.
