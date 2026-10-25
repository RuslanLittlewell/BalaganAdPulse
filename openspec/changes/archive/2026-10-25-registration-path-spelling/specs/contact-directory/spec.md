## MODIFIED Requirements

### Requirement: Invitation links are copyable

Every pending invitation row and newly created invitation result SHALL display the backend-provided registration link and provide an action that copies that link.

#### Scenario: Copying a pending employee invitation
- **WHEN** an admin copies an employee invitation from the contact book
- **THEN** the clipboard receives its `/registration/{code}` link rather than the bare code
