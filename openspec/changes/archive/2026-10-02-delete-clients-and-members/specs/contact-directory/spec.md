## ADDED Requirements

### Requirement: An admin deletes a client from the contact book

The client card SHALL offer an `ADMIN` a control that deletes the client shown. It SHALL
ask for confirmation first, naming the client and saying that its projects and campaign
data are removed with it. No other role SHALL see the control.

#### Scenario: Admin deletes a client
- **WHEN** an admin chooses delete on a client's card and confirms
- **THEN** the client is deleted, disappears from the list, and the next client is shown

#### Scenario: Admin changes their mind
- **WHEN** an admin chooses delete and then cancels the confirmation
- **THEN** nothing is deleted

#### Scenario: Manager sees no delete control
- **WHEN** a manager opens a client's card
- **THEN** no delete control is offered

#### Scenario: Deletion fails
- **WHEN** the server refuses or fails the deletion
- **THEN** the admin is told it failed and the client stays in the list
