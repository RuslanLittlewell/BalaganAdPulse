## 1. Delete a client from the contact book

- [x] 1.1 Add the confirmation and failure copy to `ru.ts`.
- [x] 1.2 In `ClientDirectory.tsx`, add an admin-only delete control on the client card with a confirmation naming the client; on success show the next client, on failure raise an alert.
- [x] 1.3 Add web tests: an admin deletes after confirming, cancelling deletes nothing, a manager sees no control, a failure is reported and the client stays.

## 2. Remove a member from the contact book

- [x] 2.1 In `EmployeeDirectory.tsx`, add an admin-only remove control on the employee card with a confirmation naming the person; on failure raise an alert.
- [x] 2.2 Add web tests: an admin removes after confirming, a manager sees no control, a refusal is reported and the person stays.
- [x] 2.3 Run `npm test` and `npm run test:web` until green; `openspec validate delete-clients-and-members --strict`.
