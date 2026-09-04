Every implementation task follows TDD: add the focused failing test, observe it fail, then add the
minimum implementation.

## 1. Reading a member's grants

- [x] 1.1 Write the failing application and HTTP tests: an admin reads them, an empty set reads as empty, a stranger's membership answers 404, and somebody who may not administer members is refused.
- [x] 1.2 Add the read to the member use cases and mount it.
- [x] 1.3 Add the entity hook for it.
- [x] 1.4 Run `npm test` — green.

## 2. The employee's reach on screen

- [x] 2.1 Write the failing tests: the projects an employee reaches are listed, a client-wide grant is shown as covering the client, and nothing offers to change it.
- [x] 2.2 Write the failing tests for adding and removing a project, and for the list settling on the result.
- [x] 2.3 Write the failing test proving somebody who may not administer members is offered no control.
- [x] 2.4 Implement it in the employee directory.
- [x] 2.5 Run `npm run test:web` — green.

## 3. The rest of the book

- [x] 3.1 Write the failing tests for the invitations moving into the dialog and leaving the directory.
- [x] 3.2 Move them.
- [x] 3.3 Write the failing tests for the minimum height and for an employee's fields matching a client's.
- [x] 3.4 Apply both, and add the Russian strings.
- [x] 3.5 Run `npm run test:web` — green.

## 4. Acceptance

- [x] 4.1 Run `openspec validate manage-employee-access --strict`.
- [x] 4.2 Run `npm test`, `npm run test:web`, `npm run build`, `npm run build:web` — all green.
