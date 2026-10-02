## Why

The currency a project's figures are stated in is whatever the advertising account bills
in, yet members pick it by hand when they create a project, and connecting Meta is refused
when the pick does not match the account. The agency wants the currency to come from the
integration alone.

## What Changes

- **BREAKING** The project create and edit API and the client registration API no longer
  accept a currency; one sent is ignored. New projects have no currency (`null`).
- The project form and the client registration form lose the currency field.
- Connecting a Meta account gives the project the account's currency. It is refused only
  when the project already holds imported figures in another currency.
- A currency is any ISO 4217 code an integration reports, not only BYN, RUB, USD and EUR.
- Amounts of a project without a currency are shown without a sign; any reported currency
  is shown with its symbol.

## Capabilities

### New Capabilities

### Modified Capabilities
- `project-management`: currency comes from integrations; forms and API take none.
- `access-control`: customers edit a project's name and picture, no longer its currency.
- `meta-project-integration`: connecting adopts the account's currency.

## Impact

- Prisma: `project.budget_currency` becomes a nullable 3-letter text column; the `currency`
  enum is dropped. Migration keeps existing values.
- API: project, identity registration and invite schemas; integration connect; OpenAPI.
- Web: project form, client registration form, currency formatting, project types.
