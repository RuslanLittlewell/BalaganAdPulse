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

### Requirement: A new organization starts on a one-month trial

An organization created through `POST /api/platform/organizations` SHALL start on `TRIAL`
with `trialEndsAt` set one calendar month after creation, at the same time of day, unless the
request names another tariff. A trial started on a day the next month does not have SHALL end on
that month's last day.
Assigning a tariff other than `TRIAL` SHALL clear `trialEndsAt`.

#### Scenario: Default tariff
- **WHEN** the platform administrator creates an organization without a tariff
- **THEN** it is on `TRIAL` and `trialEndsAt` is one month away

#### Scenario: A trial started at the end of a month
- **WHEN** an organization starts its trial on 31 January
- **THEN** the trial ends on the last day of February, at the same time of day

### Requirement: An expired trial pauses integration imports

When a `TRIAL` organization's `trialEndsAt` has passed, the system SHALL NOT start any background job for it that calls an external service: the ad metrics import, the Meta lead poll, the Search Console import, the Analytics traffic import and the site page check. A job already running SHALL finish. Stored metrics, leads and statistics SHALL stay readable and unchanged. Jobs for other organizations SHALL be unaffected.

A paused integration SHALL keep its schedule, so that once the platform administrator assigns a tariff its next run is already due and the system takes it on its next pass, without the member pressing anything.

The web app SHALL tell an organization administrator, in the read-only notice, that data is no longer updated from integrations. Web copy is Russian.

#### Scenario: Daily import after trial
- **WHEN** an integration of an organization whose trial has ended comes due for its daily import
- **THEN** no job is started and no request goes to the ad platform

#### Scenario: Lead poll after trial
- **WHEN** a Meta integration with lead import enabled belongs to an organization whose trial has ended
- **THEN** no lead poll is started for it

#### Scenario: Search and traffic imports after trial
- **WHEN** a site of an organization whose trial has ended comes due for a Search Console import, an Analytics import or a page check
- **THEN** none of them is started

#### Scenario: A manual refresh after trial
- **WHEN** a member of such an organization presses «Обновить»
- **THEN** the API responds 403 as for any write, and no job is queued

#### Scenario: A running job
- **WHEN** a job is running when the trial ends
- **THEN** it finishes and stores its result, and no further job starts

#### Scenario: Another organization
- **WHEN** one organization's trial has ended and another organization on a paid tariff has integrations due
- **THEN** the other organization's jobs run as usual

#### Scenario: Stored data stays
- **WHEN** a member of an organization whose trial has ended opens a project
- **THEN** the metrics, leads and statistics stored before the end of the trial are shown

#### Scenario: Tariff assigned after trial
- **WHEN** the platform administrator assigns `BUSINESS` to that organization
- **THEN** its due integrations are claimed on the workers' next pass and their data catches up

#### Scenario: Trial that is still running
- **WHEN** an organization's `trialEndsAt` is in the future, or the organization is on a paid tariff
- **THEN** its jobs run as usual

#### Scenario: The notice
- **WHEN** an administrator of an organization whose trial has ended opens the app
- **THEN** the read-only notice says that data from integrations is no longer updated

### Requirement: The trial countdown sits in the same place on every page

The app header SHALL show the trial countdown, and after the end the ended notice, at the same position on every page of the organization area: between the header's left area and its toolbar, whether or not the page puts anything in that left area. Pages SHALL NOT move it.

#### Scenario: The countdown in Projects
- **WHEN** a member of an organization on a running trial opens Projects
- **THEN** the countdown is where it is in CRM, between the left area and the toolbar

#### Scenario: The ended notice in Projects
- **WHEN** a member of an organization whose trial has ended opens Projects
- **THEN** the ended notice is in the same place as the countdown was

### Requirement: A refusal for an ended trial raises a toast

When any request from the web app is refused because the trial ended, the answer being 403 with details `[{ code: "TRIAL_ENDED" }]`, the app SHALL raise one error toast saying in Russian that the trial has ended and changes are unavailable. It SHALL do so for every request the app sends, from any page and any form, whatever the page had been trying to change. While the toast is on screen, a further refusal SHALL NOT raise a second one, and the failure message the page itself would raise for the same request SHALL NOT appear beside it. A form that shows the refusal inline MAY keep doing so.

#### Scenario: Editing a task
- **WHEN** a member of an organization whose trial has ended moves a task to another column
- **THEN** one toast says the trial has ended, and the task returns to its column

#### Scenario: Another page
- **WHEN** the same member renames a project or edits a lead
- **THEN** the same toast appears

#### Scenario: Several refusals at once
- **WHEN** several requests are refused for the ended trial within a few seconds
- **THEN** one toast is on screen

#### Scenario: No second message
- **WHEN** a request is refused for the ended trial and its page would otherwise raise a generic failure toast
- **THEN** only the trial toast appears

#### Scenario: Other refusals
- **WHEN** a request is refused with 403 for another reason, such as a role or a tariff limit
- **THEN** no trial toast appears and the page handles the refusal as before
