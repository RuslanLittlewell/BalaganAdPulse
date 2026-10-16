## ADDED Requirements

### Requirement: Report permissions are shared by API and UI

The shared permission matrix SHALL hold a `report` resource. Every role SHALL read reports;
only ADMIN and MANAGER SHALL create, update and delete them. Seeing a draft SHALL require the
right to update reports. Row reach SHALL stay that of the report's project.

#### Scenario: Customer and guest only read
- **WHEN** a CLIENT, CLIENT_ADMIN or GUEST of the project sends a create, update or delete for a report
- **THEN** the API responds 403 and the report controls are absent in the web app

#### Scenario: Staff manage reports
- **WHEN** an ADMIN, or a MANAGER who reaches the project, generates or publishes a report
- **THEN** it is allowed
