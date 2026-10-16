## REMOVED Requirements

### Requirement: A monthly budget is an amount in a named currency

**Reason**: A project no longer carries a monthly budget, so a requirement defining the
budget and the currency it is stated in no longer has a budget to define.

**Migration**: Replaced by "A project's figures are stated in a named currency", which keeps
every rule this requirement made about the currency itself — that a project always carries
one, that it is never inferred, that new projects default to `BYN`, and that a currency
outside the four is refused — and drops the scenarios that only existed to describe an
amount. Stored budgets are dropped by the accompanying migration; stored currencies are
untouched.

## ADDED Requirements

### Requirement: A project's figures are stated in a named currency

A project SHALL carry the currency its measured figures are stated in: `BYN`, `RUB`, `USD`
or `EUR`. Spend and every figure derived from it SHALL be shown in that currency rather than
in a fixed one, so two projects billed differently are never added up as though they were
the same money.

Every project SHALL carry a currency, whether or not any figures have been measured yet.
New projects SHALL default to `BYN`.

Currency SHALL NOT be inferred from anything else — not the client, not the locale. It is
what the agency and the client agreed, and only they know it.

#### Scenario: Creating a project

- **WHEN** a member creates a project naming a currency
- **THEN** it is stored, and the project reads back with it

#### Scenario: Creating a project without naming a currency

- **WHEN** a member creates a project naming no currency
- **THEN** the project is stored with the default currency

#### Scenario: Changing the currency

- **WHEN** a member changes a project's currency
- **THEN** the new currency is stored and the project's other fields are unchanged

#### Scenario: An unknown currency

- **WHEN** a request names a currency outside the four
- **THEN** the API responds 400 and the project is unchanged

#### Scenario: Showing a project's figures

- **WHEN** a project's measured figures are shown
- **THEN** each amount appears in that project's own currency, not in a fixed one

## MODIFIED Requirements

### Requirement: Customers create and edit their own client's projects
The projects module SHALL offer customers the control to create a project and the action to edit a project of their client. The project form SHALL fix the client to the customer's own client and SHALL NOT offer choosing another client, creating a client or deleting the project. The priority menu SHALL NOT be offered to customers. A project created by a customer SHALL appear, without further action, wherever the agency's members who reach that client see projects, with the priority every new project starts with.

#### Scenario: A client adds a project
- **WHEN** a client opens the projects module, activates the create control, enters a name and creates it
- **THEN** the project opens for them, belongs to their client, and an agency admin sees it in their projects list

#### Scenario: The client field for a customer
- **WHEN** a client opens the project form
- **THEN** their own client is selected and cannot be changed, and no Новый клиент control is offered

#### Scenario: Editing without agency controls
- **WHEN** a client edits their client's project
- **THEN** they can change its name, currency and picture, and are offered no deletion and no priority choice
