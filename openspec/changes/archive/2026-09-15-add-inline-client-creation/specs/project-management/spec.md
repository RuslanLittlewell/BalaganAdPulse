## ADDED Requirements

### Requirement: A client can be created from the project form
The project form SHALL offer, beside its client select and to members who may create clients, a control named Новый клиент that opens the new-client form without closing the project form. A client created there SHALL be added to the organization's clients, appear in the contact book and in the client select, and become the selected client of the project form. Cancelling the new-client form SHALL leave the project form and its selected client unchanged. Members who may not create clients SHALL NOT be offered the control.

#### Scenario: Create and select a client
- **WHEN** a manager creating a project activates Новый клиент, enters a client name and creates it
- **THEN** the new-client form closes, the project form shows the new client as selected, and creating the project assigns it to that client

#### Scenario: Cancel
- **WHEN** a manager opens Новый клиент from the project form and cancels
- **THEN** the project form keeps its previously selected client

#### Scenario: The contact book shows the new client
- **WHEN** a client was created from the project form
- **THEN** the contact book lists it without a reload
