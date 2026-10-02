## 1. Managers list the staff

- [x] 1.1 In `member-use-cases.ts`, let a `MANAGER` list members with `kind=staff`; keep every other listing admin-only.
- [x] 1.2 Update API tests: a manager lists staff (themselves and admins, no customers), is refused without `kind=staff`; a guest is refused.

## 2. The picker offers active staff

- [x] 2.1 In `TaskFormDialog.tsx`, offer only active members in the responsible-member picker, keeping the current one.
- [x] 2.2 Add web tests: suspended members are not offered; a task assigned to a suspended member still shows them.
- [x] 2.3 Run `npm test` and `npm run test:web` until green; `openspec validate managers-assign-tasks-to-staff --strict`.
