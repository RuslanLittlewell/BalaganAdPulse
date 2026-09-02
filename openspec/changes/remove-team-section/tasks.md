Every implementation task follows TDD: add the focused failing test, observe it fail, then add the
minimum implementation.

## 1. Removing the section

- [x] 1.1 Write the failing test proving the navigation offers no Team entry, for an admin as well as anyone else.
- [x] 1.2 Write the failing test proving `/team` lands on the dashboard.
- [x] 1.3 Remove the navigation entry, the page, its route and its tests, and redirect the address.
- [x] 1.4 Remove the strings nothing else uses, keeping those the contact book and invitations still need.
- [x] 1.5 Run `npm run test:web` — green.

## 2. Acceptance

- [x] 2.1 Confirm the contact book still lists members, and that no source file references the removed page.
- [x] 2.2 Update the README where it describes the Team section.
- [x] 2.3 Run `openspec validate remove-team-section --strict`.
- [x] 2.4 Run `npm test`, `npm run test:web`, `npm run build`, `npm run build:web` — all green.
