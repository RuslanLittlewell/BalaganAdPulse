## ADDED Requirements

### Requirement: A monthly budget is an amount in a named currency

A project's monthly budget SHALL carry the currency it is stated in: `BYN`, `RUB`, `USD`
or `EUR`. A budget SHALL NOT be stored as a bare number, and wherever one is shown it
SHALL be shown with its currency.

A project with no budget SHALL still carry a currency, so that entering an amount later
does not also require choosing one. New projects SHALL default to `BYN`.

Currency SHALL NOT be inferred from anything else — not the client, not the locale. It is
what the agency and the client agreed, and only they know it.

#### Scenario: Creating a project with a budget

- **WHEN** a member creates a project with a monthly budget and a currency
- **THEN** both are stored, and the project reads back with them

#### Scenario: Creating a project without a budget

- **WHEN** a member creates a project naming no budget
- **THEN** the project is stored with no amount and the default currency

#### Scenario: Changing the currency alone

- **WHEN** a member changes a project's currency without touching the amount
- **THEN** the amount is unchanged and the new currency is stored

#### Scenario: An unknown currency

- **WHEN** a request names a currency outside the four
- **THEN** the API responds 400 and the project is unchanged

#### Scenario: Showing a budget

- **WHEN** a project with a budget is shown
- **THEN** the amount appears with its own currency, not with a fixed one
