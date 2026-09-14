## MODIFIED Requirements

### Requirement: Lead import status is visible and separate
The connection read SHALL expose the lead import state, the time of the last successful lead poll and a safe failure reason. The project's Meta integration panel SHALL show the time of the last successful lead poll in Russian, and SHALL explain lead import in Russian only while it needs access or its last poll failed; it SHALL NOT show the lead import state otherwise. A refusal caused by missing lead permissions or Leads Access Manager restrictions SHALL mark only lead import as needing access, explain which access is required, and SHALL NOT change the advertising import status or request a new token. Such a connection SHALL be retried at least hourly and SHALL recover without member action once access is granted. A credential Meta rejects as invalid or expired SHALL follow the existing credential replacement flow. Transient failures SHALL be retried at the next poll.

#### Scenario: Token lacks lead permission
- **WHEN** the saved token can read advertising but not leads
- **THEN** advertising imports keep succeeding, the panel reports that lead access is missing, and no token replacement is requested

#### Scenario: Access granted later
- **WHEN** lead access is granted to a connection previously refused
- **THEN** a poll within the next hour succeeds and imports leads from the covered period

#### Scenario: Restricted reader
- **WHEN** a member without project update permission reads the project
- **THEN** no lead import status or failure reason is exposed to them

#### Scenario: Healthy lead import
- **WHEN** lead polls succeed
- **THEN** the panel shows only the time of the last successful lead poll, which moves forward with each poll, and no lead import state

#### Scenario: Before the first lead poll
- **WHEN** a connection has not completed a lead poll yet and nothing has failed
- **THEN** the panel shows nothing about lead import
