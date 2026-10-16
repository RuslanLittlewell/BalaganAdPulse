## MODIFIED Requirements

### Requirement: Lead import can be switched off per connection

Each Meta connection SHALL carry a lead import switch, shown in its connection settings window
to members who may manage integrations when the organization has the CRM module, and off by
default. The window for a new connection SHALL show it off, and the connection SHALL be
created with the chosen setting; a connection created without the setting, or while the
organization has no CRM module, SHALL be created with lead import off. For an existing
connection, changing it SHALL take effect at once, without re-entering the token. While it is
off the connection SHALL NOT be polled for leads; its advertising import SHALL continue and
leads already imported SHALL remain. Switching it on SHALL request a lead poll at once.
Changing the switch SHALL require the integration permission and project reach.

Beside the switch an information button SHALL open instructions for what to set up in Meta
for leads to be readable through the API: the token permissions, access to the Facebook page
the lead forms belong to, and lead access in the Leads Access Manager.

#### Scenario: Switching lead import off
- **WHEN** a member switches off lead import on a connection
- **THEN** no further lead polls run for it, its campaigns keep updating, and existing leads stay on the board

#### Scenario: Switching it back on
- **WHEN** the member switches lead import on again
- **THEN** a lead poll is requested immediately

#### Scenario: A new connection
- **WHEN** a member opens the window to connect a Meta account
- **THEN** the lead import switch is off, and the account is connected with lead import off unless they switched it on

#### Scenario: A connection created through the API without the setting
- **WHEN** a Meta account is connected without saying whether to import leads
- **THEN** the connection is created with lead import off

#### Scenario: An organization without CRM
- **WHEN** a member of an organization without the CRM module opens the connection window
- **THEN** no lead import switch is shown, and the account is connected with lead import off

#### Scenario: Reading how to set it up
- **WHEN** the member presses the information button beside the switch
- **THEN** the steps to set up in Meta are shown
