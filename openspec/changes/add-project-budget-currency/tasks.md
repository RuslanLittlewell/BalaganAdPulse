Every implementation task follows TDD: add the focused failing test, observe it fail, then add the
minimum implementation.

## 1. Storing the currency

- [x] 1.1 Write the failing repository tests for storing a budget with its currency and defaulting without one.
- [x] 1.2 Add the `Currency` enum and the column, with its migration.
- [x] 1.3 Carry the field through the project ports, use cases and adapter.
- [x] 1.4 Write the failing HTTP tests for creating and updating it, including an unknown currency.
- [x] 1.5 Accept it in the schemas, and in the client registration's project step.
- [x] 1.6 Run `npm test` — green.

## 2. Showing and entering it

- [x] 2.1 Write the failing test for `formatCurrency` rendering each of the four.
- [x] 2.2 Give `formatCurrency` a currency, defaulting to the one it already used.
- [x] 2.3 Write the failing tests for the currency select in the project form and the project header.
- [x] 2.4 Add the select and show the budget in its own currency.
- [x] 2.5 Write the failing tests for the budget and currency on the registration's project step.
- [x] 2.6 Add them to the registration form, with the Russian strings.
- [x] 2.7 Run `npm run test:web` — green.

## 3. Acceptance

- [x] 3.1 Update the README where it describes a project.
- [x] 3.2 Run `openspec validate add-project-budget-currency --strict`.
- [x] 3.3 Run `npm test`, `npm run test:web`, `npm run build`, `npm run build:web` — all green.
