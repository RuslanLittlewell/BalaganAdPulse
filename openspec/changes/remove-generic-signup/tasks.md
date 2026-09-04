Every implementation task follows TDD: add the focused failing test, observe it fail, then add the
minimum implementation.

## 1. Removing the screen

- [x] 1.1 Write the failing test proving the sign-in screen offers no way to create an account.
- [x] 1.2 Write the failing test proving `/signup` lands on the sign-in form.
- [x] 1.3 Remove the page, its route, its tests and the link, and redirect the address.
- [x] 1.4 Remove the strings nothing else uses.
- [x] 1.5 Run `npm run test:web` — green.

## 2. Acceptance

- [x] 2.1 Confirm registration by invitation link still works for all three kinds, and that the API still refuses a registration with no redeemable code.
- [x] 2.2 Update the README where it describes getting in.
- [x] 2.3 Run `openspec validate remove-generic-signup --strict`.
- [x] 2.4 Run `npm test`, `npm run test:web`, `npm run build`, `npm run build:web` — all green.
