## ADDED Requirements

### Requirement: A permission refusal reported as an invalid parameter needs access

Meta SHALL be treated as refusing lead access when a lead request fails with error code 100 and a message naming a missing permission. Lead import SHALL then be marked as needing access and retried at least hourly, exactly as for other lead access refusals. A code 100 error without such a message SHALL stay an invalid data failure.

#### Scenario: Missing leads_retrieval
- **WHEN** Meta answers a lead request with code 100 and "Requires pages_manage_ads or leads_retrieval permission to manage the object"
- **THEN** lead import is marked as needing access and the panel explains which access to grant

#### Scenario: Another invalid parameter
- **WHEN** Meta answers a lead request with code 100 and a message that names no permission
- **THEN** the failure is reported as invalid data
