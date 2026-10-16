## MODIFIED Requirements

### Requirement: A new organization's admin is pointed to the contact book

While an organization has no clients and no employees other than the signed-in admin, the
contact book button in the header SHALL carry the hint "Добавить клиентов и сотрудников".
It SHALL be shown only to an organization `ADMIN`, SHALL be hidden while the contact book
is open, and SHALL no longer be shown once the organization has a client or another
employee.

#### Scenario: A fresh organization
- **WHEN** the first admin of an organization with no clients and no other employees opens
  the app
- **THEN** the contact book button carries the hint

#### Scenario: An organization with people
- **WHEN** the organization has a client or an employee besides the admin
- **THEN** no hint is shown

#### Scenario: Another role
- **WHEN** a manager, guest or customer opens the app of a fresh organization
- **THEN** no hint is shown

## ADDED Requirements

### Requirement: An empty client list points at the add button

While the organization has no clients, the contact book's add-client button SHALL carry the
hint "Создайте клиента", above the button, for anyone who may create a client. The hint SHALL show above the
open contact book, SHALL be hidden while a client is being created, and SHALL no longer be
shown once a client exists. Closing it SHALL be remembered on its own, apart from any other
hint.

#### Scenario: An empty client list
- **WHEN** an admin or a manager opens the contact book of an organization with no clients
- **THEN** the add-client button carries the hint

#### Scenario: Clients exist
- **WHEN** the organization has a client
- **THEN** no hint is shown on the add-client button

#### Scenario: Someone who may not create clients
- **WHEN** a guest opens the contact book of an organization with no clients
- **THEN** no hint is shown

#### Scenario: Closing it
- **WHEN** the person closes the hint and opens the contact book again
- **THEN** the hint does not return, while the header hint is unaffected
