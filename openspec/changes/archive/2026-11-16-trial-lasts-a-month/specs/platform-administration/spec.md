## MODIFIED Requirements

### Requirement: The platform administrator adds an organization

`POST /api/platform/organizations` SHALL take a name, an optional tariff and the email of
the first administrator. The tariff defaults to `TRIAL`. It SHALL create the organization
with that tariff, whose modules follow the tariff, and an `ADMIN` invitation for that
email with no project grants. It SHALL return the organization and the invitation's
registration URL. The slug SHALL be derived from the name and made unique.

The web app SHALL offer this as a form with the name, a tariff selector and the email.
The selector SHALL describe each tariff by its audience, limits and price in text. On
success the registration link SHALL be shown for copying.

#### Scenario: Organization with a tariff
- **WHEN** the platform administrator adds "Acme" on `BUSINESS`
- **THEN** Acme is stored with Dashboard, Projects and CRM, and an `ADMIN` invitation
  for the given email exists

#### Scenario: Default trial
- **WHEN** the platform administrator adds "Acme" without a tariff
- **THEN** Acme is on `TRIAL` with `trialEndsAt` one month ahead

#### Scenario: First administrator registers
- **WHEN** the invited person opens the registration link and completes registration
- **THEN** they become an active `ADMIN` of Acme and of no other organization

#### Scenario: Unknown tariff
- **WHEN** the request names a tariff that does not exist
- **THEN** the API responds 400 and stores nothing

#### Scenario: Unknown module
- **WHEN** the request carries a `modules` list
- **THEN** the API responds 400 and stores nothing

#### Scenario: Same name twice
- **WHEN** an organization with the same name already exists
- **THEN** the second is created with a distinct slug

#### Scenario: Invalid email
- **WHEN** the administrator email is not a valid address
- **THEN** the API responds 400 and stores nothing
