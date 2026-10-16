## Purpose

Each organization is entitled to a set of modules according to its tariff. The set decides
what the organization sees and what its API answers.

## ADDED Requirements

### Requirement: Dashboard and Projects are always enabled

Every organization SHALL have the Dashboard and Projects modules enabled, and no request
SHALL be able to switch them off. CRM, Tasks and Reports SHALL be optional.

#### Scenario: Organization with no optional modules
- **WHEN** an organization is entitled to no optional module
- **THEN** its members still reach the dashboard and projects

### Requirement: A disabled module does not exist for the organization

For a member of an organization where CRM, Tasks or Reports is disabled, every endpoint of
that module SHALL answer 404 with the standard envelope, for every role, and the module
SHALL be absent from the navigation and its routes redirect to the dashboard.

CRM covers `/api/crm`. Tasks covers `/api/tasks` and `/api/task-images`. Reports covers
`/api/reports` and `/api/projects/:projectId/reports`.

#### Scenario: CRM disabled
- **WHEN** an admin of an organization without CRM calls `GET /api/crm/leads`
- **THEN** the API responds 404

#### Scenario: Tasks disabled in the navigation
- **WHEN** a member of an organization without Tasks opens the app
- **THEN** the navigation has no Tasks entry, and opening `/tasks` redirects to the dashboard

#### Scenario: Enabled module unaffected
- **WHEN** an organization has Reports enabled and CRM disabled
- **THEN** reports work as before

#### Scenario: Another organization's modules
- **WHEN** organization A has CRM and organization B does not
- **THEN** members of A reach CRM and members of B receive 404

### Requirement: The module set can be changed after creation

The platform administrator SHALL be able to add and remove optional modules of an
existing organization. A change SHALL apply to the organization's next request. Removing a
module SHALL hide it without deleting its data; adding it back SHALL restore access to
that data unchanged.

#### Scenario: Remove then restore
- **WHEN** Reports is removed from an organization and added again later
- **THEN** the organization's earlier reports are available again

### Requirement: The session names the enabled modules

`GET /api/auth/me` SHALL return the organization's enabled modules, always including
`DASHBOARD` and `PROJECTS`, so the web app can build its navigation from them.

#### Scenario: Member session
- **WHEN** a member of an organization with only Tasks optional calls `GET /api/auth/me`
- **THEN** the modules are `DASHBOARD`, `PROJECTS` and `TASKS`

### Requirement: Existing organizations keep every module

Organizations that exist when this capability is introduced SHALL have CRM, Tasks and
Reports enabled.

#### Scenario: Balagan after migration
- **WHEN** the migration has run against the production data
- **THEN** Balagan's members see every module they saw before
