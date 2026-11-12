## ADDED Requirements

### Requirement: Share link permissions are shared by API and UI

The shared permission matrix SHALL hold a `share-link` resource. Only ADMIN SHALL read,
create, update and delete share links; MANAGER, GUEST, CLIENT and CLIENT_ADMIN SHALL do none
of these. Row reach SHALL stay that of the link's project.

#### Scenario: An admin manages the link
- **WHEN** an ADMIN creates, replaces or switches off a project's share link
- **THEN** it is allowed

#### Scenario: Others are refused
- **WHEN** a MANAGER, GUEST, CLIENT or CLIENT_ADMIN who reaches the project reads, creates, replaces or switches off its share link through the API
- **THEN** the API responds 403 and the web app shows no sharing control

#### Scenario: A project of another organization
- **WHEN** an ADMIN asks for the share link of a project in another organization
- **THEN** the API responds 404
