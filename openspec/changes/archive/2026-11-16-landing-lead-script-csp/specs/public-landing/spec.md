## ADDED Requirements

### Requirement: The landing may send leads to the application

The landing's content security policy SHALL allow connections to its own host and to the application's origin, and to no other host, so that the lead intake script on the page can reach the CRM.

#### Scenario: A lead leaves the landing
- **WHEN** a visitor submits the contact form and the script sends the lead to the application host
- **THEN** the browser does not block the request

#### Scenario: Another host
- **WHEN** the page tries to connect to any other host
- **THEN** the browser blocks the connection
