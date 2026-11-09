## MODIFIED Requirements

### Requirement: Navigation within a module does not fade
Moving between routes inside the same module SHALL NOT trigger the module fade.

#### Scenario: Switching view within a module
- **WHEN** a member toggles between board and tasks layout inside the CRM module
- **THEN** no module-level fade transition plays
