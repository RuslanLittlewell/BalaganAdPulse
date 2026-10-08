## 1. The API accepts an admin invitation without projects

- [x] 1.1 Add failing tests: an `ADMIN` invitation with no projects is stored with no projects
  and redeems into an admin with no grants; an `ADMIN` invitation naming projects is 400; a
  `MANAGER` and a `GUEST` invitation without projects stay 400.
- [x] 1.2 Make `projectIds` optional in the `EMPLOYEE` branch of `createInviteSchema` and
  enforce the per-role rule in `invite-use-cases.ts`.
- [x] 1.3 Run `npm test` until green.

## 2. The dialog hides projects for an admin

- [x] 2.1 Add failing tests to the `InvitationDialog` tests: choosing Администратор hides the
  project picker and creates the invitation with no projects and no "choose a project"
  refusal; a manager still has to choose one.
- [x] 2.2 Hide the fieldset and skip the project check while the role is `ADMIN` in
  `InvitationDialog.tsx`, sending `projectIds: []`.
- [x] 2.3 Run `npm run test:web` until green.

## 3. Close the change

- [x] 3.1 Run `npm test`, `npm run test:web` and both builds until green.
- [x] 3.2 Run `openspec validate invite-admin-without-projects --strict`.
