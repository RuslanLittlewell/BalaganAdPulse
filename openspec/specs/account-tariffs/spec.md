# account-tariffs Specification

## Purpose
TBD - created by archiving change account-tariffs. Update Purpose after archive.

## Requirements

### Requirement: Every organization has one tariff

Every organization SHALL have exactly one tariff: `TRIAL`, `SOLO`, `BUSINESS`, `AGENCY`,
`AGENCY_PRO` or `ENTERPRISE`. Only the platform administrator SHALL assign or change it.
No payment is taken by the system.

#### Scenario: Member tries to change the tariff
- **WHEN** an organization `ADMIN` sends a tariff change
- **THEN** the API responds 403 and the tariff is unchanged

### Requirement: The tariff catalogue fixes limits and modules

The tariffs SHALL carry these limits and optional modules. `null` means no limit.

| Tariff | Projects | Clients | Users | Ad accounts | Optional modules |
| --- | --- | --- | --- | --- | --- |
| `TRIAL` | 15 | 15 | 5 | none | CRM, Tasks, Reports |
| `SOLO` | 5 | none | 1 | none | none |
| `BUSINESS` | none | 1 | 3 | 3 | CRM |
| `AGENCY` | 15 | 15 | 5 | none | CRM, Tasks, Reports |
| `AGENCY_PRO` | 40 | 40 | 15 | none | CRM, Tasks, Reports |
| `ENTERPRISE` | none | none | none | none | CRM, Tasks, Reports |

Users SHALL count active members plus pending invitations. Ad accounts SHALL count the
organization's project integrations.

#### Scenario: Catalogue lookup
- **WHEN** an organization is on `AGENCY`
- **THEN** its limits are 15 projects, 15 clients and 5 users with CRM, Tasks and Reports

### Requirement: A new organization starts on a 14-day trial

An organization created through `POST /api/platform/organizations` SHALL start on `TRIAL`
with `trialEndsAt` set 14 days after creation, unless the request names another tariff.
Assigning a tariff other than `TRIAL` SHALL clear `trialEndsAt`.

#### Scenario: Default tariff
- **WHEN** the platform administrator creates an organization without a tariff
- **THEN** it is on `TRIAL` and `trialEndsAt` is 14 days away

### Requirement: Creating a record over a limit is refused

Creating a project, a client, an invitation, a member or an ad account that would exceed
the tariff's limit SHALL answer 403 with an error message naming the limit and details
`[{ code: "TARIFF_LIMIT", resource, limit }]`. Nothing SHALL be stored. The web app SHALL
show the refusal in Russian in the form that sent the request. Existing records over a new, lower limit SHALL stay and remain usable.

#### Scenario: Solo creates a sixth project
- **WHEN** an organization on `SOLO` with five projects creates another
- **THEN** the API responds 403 and the project is not stored

#### Scenario: Pending invitation counts
- **WHEN** a `BUSINESS` organization has two active members and one pending invitation
- **THEN** a further invitation answers 403

#### Scenario: Downgrade keeps data
- **WHEN** an organization with eight projects moves to `SOLO`
- **THEN** all eight projects stay readable and editable, and a ninth cannot be created

### Requirement: An expired trial makes the organization read-only

When a `TRIAL` organization's `trialEndsAt` has passed, every write request from its
members SHALL answer 403 with a message that the trial has ended. Reads SHALL keep
working. Assigning a tariff SHALL restore writes on the next request.

#### Scenario: Write after trial
- **WHEN** a member of an organization whose trial ended creates a task
- **THEN** the API responds 403

#### Scenario: Read after trial
- **WHEN** the same member opens the project list
- **THEN** the API responds 200 with the projects

#### Scenario: Tariff assigned after trial
- **WHEN** the platform administrator assigns `BUSINESS` to that organization
- **THEN** its members can write again on the next request

### Requirement: The session reports tariff and usage

`GET /api/auth/me` SHALL return the organization's tariff, `trialEndsAt`, the limits and
the current usage of projects, clients, users and ad accounts. The web app SHALL show
them to organization administrators, and SHALL show a banner with the days left while a
trial runs and a read-only notice after it ends. Web copy is Russian.

#### Scenario: Trial banner
- **WHEN** a member of an organization with six trial days left opens the app
- **THEN** a banner shows the days left

#### Scenario: Usage shown
- **WHEN** an `ADMIN` of an `AGENCY` organization with 4 projects opens the tariff view
- **THEN** it shows 4 of 15 projects

### Requirement: Existing organizations move to Enterprise

Every organization that exists when this capability is introduced SHALL have tariff
`ENTERPRISE` with no `trialEndsAt`, so it keeps every module and has no limits.

#### Scenario: Balagan after migration
- **WHEN** the migration has run against the production data
- **THEN** every existing organization is on `ENTERPRISE` and its members see everything they saw before
