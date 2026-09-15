## ADDED Requirements

### Requirement: Clients are added from the bottom of the client list
The client directory of the contact book SHALL offer members who may create clients a round control named Новый контакт at the bottom right of the client list, and SHALL NOT offer another creation control in the details header. Activating it SHALL open the new-contact form beside the list. The control SHALL be absent for members who may not create clients. A client name too long for the list SHALL be shortened with an ellipsis and SHALL expose the full name on hover.

#### Scenario: Adding a client
- **WHEN** an admin activates Новый контакт at the bottom of the client list
- **THEN** the new-contact form opens beside the list

#### Scenario: A reader
- **WHEN** a guest opens the contact book
- **THEN** no Новый контакт control is offered

#### Scenario: A long name
- **WHEN** a client's name does not fit the list
- **THEN** it is shortened and its full name is shown on hover
