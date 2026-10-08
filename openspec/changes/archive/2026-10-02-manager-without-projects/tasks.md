## 1. Manager invitation without projects

- [x] 1.1 In `invite-use-cases.ts`, require projects for `GUEST` only; keep validating any projects a `MANAGER` invitation names.
- [x] 1.2 In `InvitationDialog.tsx`, demand a project only for a guest.
- [x] 1.3 Add API tests: a `MANAGER` invitation without projects is stored and redeems to a manager with no grants; a `GUEST` one is still refused with 400. Update the test that expected 400 for a manager.
- [x] 1.4 Add web tests: the dialog sends a manager invitation with no projects, and refuses a guest invitation without one.
- [x] 1.5 Run `npm test` and `npm run test:web` until green.

## 2. A manager reaches the projects they create

- [x] 2.1 In `project-use-cases.ts`, grant the creating `MANAGER` access to the new project inside the creation transaction.
- [x] 2.2 Add API tests: a manager without grants creates a client and a project and both they and an admin list it; a manager holding only an A1 grant creates A2 and reaches A1 and A2 but no other project of the client; a manager naming another organization's client gets 404 and nothing is stored; an admin creating a project without staff stores no grant.
- [x] 2.3 Run `npm test` and `npm run test:web` until green; `openspec validate manager-without-projects --strict`.
