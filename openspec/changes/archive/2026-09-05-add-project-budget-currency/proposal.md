## Why

A project's monthly budget is a bare number. The agency works with clients in Belarus,
Russia and abroad, so the same figure means four different things depending on whose
project it is — and nothing on screen says which.

## What Changes

- A project's monthly budget carries the currency it is stated in: `BYN`, `RUB`, `USD`
  or `EUR`.
- The project form and the client registration's project step both ask for it.
- Wherever a budget is shown, it is shown in its own currency.

## Capabilities

### Modified Capabilities

- `project-management`: a project's monthly budget is an amount in a named currency.

## Impact

- `apps/api`: a `Currency` enum and a `budgetCurrency` column on `project`, its
  migration, and the field through the ports, use cases and schemas.
- `apps/web`: the project form, the client registration's project step, and the project
  header that shows a budget.

## Out of scope

**Measured spend keeps its own formatting.** What a campaign spent comes from the
platform's account and is a different figure from what the client agreed to spend a month
on; conflating the two would need a rate and a date, which is a larger change than this.
