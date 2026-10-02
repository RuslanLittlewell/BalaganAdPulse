## MODIFIED Requirements

### Requirement: Connected projects are polled for leads
The server SHALL poll Meta for Instant Form leads of every connection whose lead import is switched on no less often than every fifteen minutes, using that connection's saved credential and requiring no input beyond the existing connection. Only leads Meta attributes to an ad of that connection's account SHALL be imported. Lead polling SHALL run independently of the daily advertising import: neither SHALL wait for, block or fail the other. At most one lead poll per connection SHALL be active across all server instances. Polling SHALL survive process restarts and resume overdue work. A connection waiting for credential replacement SHALL NOT be polled.

A manual refresh of the connection SHALL also request an immediate lead poll.

#### Scenario: A prospect submits a form
- **WHEN** a prospect submits an Instant Form on an ad of a connected project
- **THEN** the lead appears on the project client's CRM board within fifteen minutes of Meta making it available

#### Scenario: Competing workers
- **WHEN** two server instances find the same project due for a lead poll
- **THEN** only one polls it and only its current ownership may create leads

#### Scenario: Advertising import in progress
- **WHEN** a long advertising import is running for a project
- **THEN** lead polls for that project continue on schedule

#### Scenario: Credential replacement required
- **WHEN** a connection is waiting for a new token
- **THEN** no lead poll runs until the token is replaced or a manual retry is requested

## ADDED Requirements

### Requirement: Lead import can be switched off per connection

Each Meta connection SHALL carry a lead import switch, shown in its connection settings window
to members who may manage integrations, and on by default. The window for a new connection
SHALL show it on, and the connection SHALL be created with the chosen setting; for an existing
connection, changing it SHALL take effect at once, without re-entering the token. While it is off the connection SHALL NOT be polled
for leads; its advertising import SHALL continue and leads already imported SHALL remain.
Switching it on SHALL request a lead poll at once. Changing the switch SHALL require the
integration permission and project reach.

#### Scenario: Switching lead import off
- **WHEN** a member switches off lead import on a connection
- **THEN** no further lead polls run for it, its campaigns keep updating, and existing leads stay on the board

#### Scenario: Switching it back on
- **WHEN** the member switches lead import on again
- **THEN** a lead poll is requested immediately

#### Scenario: A new connection
- **WHEN** a member opens the window to connect a Meta account
- **THEN** the lead import switch is on, and the account is connected with lead import on unless they switched it off
