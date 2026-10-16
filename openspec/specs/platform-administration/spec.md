# platform-administration Specification

## Purpose
The platform administration lets the owner of the instance see every organization using
it and add new ones by hand, ahead of any automated provisioning.

## Requirements

### Requirement: One platform administrator exists

The instance SHALL have at most one platform administrator. It is an ordinary login that
belongs to no organization. The seed command SHALL create it from
`SEED_PLATFORM_ADMIN_EMAIL` and `SEED_PLATFORM_ADMIN_PASSWORD`, SHALL refuse a password
shorter than eight characters, and SHALL be safe to run again without changing an
existing account.

#### Scenario: First seed
- **WHEN** the seed runs with both variables set and no platform administrator exists
- **THEN** the account is created with that email and a hashed password

#### Scenario: Seed run twice
- **WHEN** the seed runs again after the account exists
- **THEN** nothing changes and the command reports that nothing was done

#### Scenario: Variables missing
- **WHEN** the seed runs without the email or the password
- **THEN** it fails naming the missing variable and creates nothing

### Requirement: The platform administrator reaches the platform and nothing else

The platform administrator SHALL be able to use only `/api/platform` and the session
endpoints. Every organization endpoint SHALL refuse them as it refuses any account with
no membership. No organization member, whatever their role, SHALL reach `/api/platform`.

#### Scenario: Platform administrator opens the projects API
- **WHEN** the platform administrator calls `GET /api/projects`
- **THEN** the API responds 403

#### Scenario: Organization admin opens the platform API
- **WHEN** an organization `ADMIN` calls `GET /api/platform/organizations`
- **THEN** the API responds 403

#### Scenario: Unauthenticated request
- **WHEN** a caller without a session calls `GET /api/platform/organizations`
- **THEN** the API responds 401

### Requirement: The platform administrator sees every organization

`GET /api/platform/organizations` SHALL return every organization on the instance, newest
last, each with its name, slug, enabled modules, number of active members, creation time
its status (`ACTIVE` or `SUSPENDED`) and the state of its first administrator's invitation (`PENDING`, `ACCEPTED`, or
absent for organizations that predate the platform administration).

#### Scenario: The current organization is listed
- **WHEN** the platform administrator lists organizations on the existing instance
- **THEN** Balagan appears with Dashboard, Projects, CRM, Tasks and Reports enabled and
  its active member count

#### Scenario: A suspended organization is listed
- **WHEN** an organization has been suspended
- **THEN** the list shows it with status `SUSPENDED`

#### Scenario: A freshly added organization
- **WHEN** the platform administrator lists organizations right after adding one
- **THEN** it appears with zero active members and a `PENDING` first administrator

### Requirement: The platform administrator adds an organization

`POST /api/platform/organizations` SHALL take a name, a list of optional modules and the
email of the first administrator. It SHALL create the organization with Dashboard and
Projects always enabled plus the listed optional modules, and an `ADMIN` invitation for
that email with no project grants. It SHALL return the organization and the invitation's
registration URL. The slug SHALL be derived from the name and made unique.

The web app SHALL offer this as a form with the name, one checkbox per optional module
and the email; Dashboard and Projects SHALL be shown as included and unchangeable. On
success the registration link SHALL be shown for copying.

#### Scenario: Organization with a tariff
- **WHEN** the platform administrator adds "Acme" with modules `CRM` and `REPORTS`
- **THEN** Acme is stored with Dashboard, Projects, CRM and Reports, and an `ADMIN`
  invitation for the given email exists

#### Scenario: First administrator registers
- **WHEN** the invited person opens the registration link and completes registration
- **THEN** they become an active `ADMIN` of Acme and of no other organization

#### Scenario: Unknown module
- **WHEN** the request lists a module that does not exist, or lists `DASHBOARD` or
  `PROJECTS` as optional
- **THEN** the API responds 400 and stores nothing

#### Scenario: Same name twice
- **WHEN** an organization with the same name already exists
- **THEN** the second is created with a distinct slug

#### Scenario: Invalid email
- **WHEN** the administrator email is not a valid address
- **THEN** the API responds 400 and stores nothing

### Requirement: The platform administrator edits an organization

`PATCH /api/platform/organizations/:id` SHALL accept any of a new name, a new list of
optional modules and a new status, and apply the ones given. The slug SHALL NOT change
with the name. An unknown organization SHALL answer 404. Every change is limited to the
platform administrator.

The web app SHALL offer an edit dialog with the name and the module checkboxes, with
Dashboard and Projects shown as included and unchangeable.

#### Scenario: Renaming
- **WHEN** the platform administrator renames "Acme" to "Acme Ltd"
- **THEN** the table shows the new name and the slug is unchanged

#### Scenario: Adding a module
- **WHEN** the platform administrator adds `TASKS` to an organization without it
- **THEN** its members see the Tasks module on their next request

#### Scenario: Removing a module
- **WHEN** the platform administrator removes `CRM` from an organization
- **THEN** its CRM endpoints answer 404 on the next request and its leads remain stored

#### Scenario: Invalid change
- **WHEN** the request lists an unknown module, lists `DASHBOARD` or `PROJECTS` as
  optional, names an unknown status or gives an empty name
- **THEN** the API responds 400 and changes nothing

#### Scenario: Unknown organization
- **WHEN** the platform administrator patches an id that does not exist
- **THEN** the API responds 404

### Requirement: The platform administrator suspends and reactivates an organization

An organization SHALL be `ACTIVE` or `SUSPENDED`; new organizations are `ACTIVE`. While
`SUSPENDED`, every request by any of its members to an organization endpoint SHALL be
refused with 403 and the message "Organization is suspended", starting with the member's
very next request. Its members' realtime connections SHALL receive no events, and an
invitation to it SHALL NOT be redeemable. Signing in SHALL still work, and
the web app SHALL show a notice that access is suspended instead of the application.
Suspension SHALL NOT delete or alter any of the organization's data. Reactivating SHALL
restore access to everything as it was, including the module set. The platform
administrator SHALL confirm a suspension in the web app before it is sent.

#### Scenario: Suspending
- **WHEN** the platform administrator suspends an organization whose admin holds a valid
  access token
- **THEN** that admin's next request answers 403 "Organization is suspended"

#### Scenario: The notice
- **WHEN** a member of a suspended organization signs in
- **THEN** the app shows that access is suspended and offers nothing else but signing out

#### Scenario: Data survives
- **WHEN** an organization is suspended and later reactivated
- **THEN** its clients, projects, tasks and leads are exactly as they were

#### Scenario: Other organizations unaffected
- **WHEN** one organization is suspended
- **THEN** members of every other organization work as before

#### Scenario: Unredeemed invitation
- **WHEN** someone opens a registration link of a suspended organization
- **THEN** registration is refused and no account is created

#### Scenario: Realtime
- **WHEN** an organization is suspended while its members hold open realtime connections
- **THEN** those connections stop receiving events

### Requirement: The platform administrator lands in the platform area

After signing in, the platform administrator SHALL see a separate shell whose navigation
holds one module, "Организации", and SHALL NOT see the organization modules.

#### Scenario: Signing in
- **WHEN** the platform administrator signs in
- **THEN** the organizations table is shown and the navigation offers only that module

#### Scenario: Opening an organization route
- **WHEN** the platform administrator opens `/projects` directly
- **THEN** they are redirected to the organizations table

### Requirement: The platform administrator deletes an organization

`DELETE /api/platform/organizations/:id` SHALL delete the organization and everything it
holds — its members, clients, projects, campaigns, tasks, leads, reports, documents,
invitations and audit events — together with the accounts of its people that hold no
membership in another organization. It SHALL answer 204, 404 for an unknown organization,
and refuse anyone but the platform administrator. Nothing of any other organization SHALL
change. The web app SHALL ask for the organization's name to be typed before deleting.

#### Scenario: Deleting an organization
- **WHEN** the platform administrator deletes an organization
- **THEN** it no longer appears in the list, and its clients, projects, tasks and leads are
  gone

#### Scenario: Its people's accounts
- **WHEN** an organization is deleted
- **THEN** its people can no longer sign in, and their addresses can be invited again

#### Scenario: Other organizations
- **WHEN** one organization is deleted
- **THEN** every other organization, its people and its data are unchanged

#### Scenario: Unknown organization
- **WHEN** the platform administrator deletes an id that does not exist
- **THEN** the API responds 404

#### Scenario: An organization admin
- **WHEN** an organization admin calls the delete endpoint
- **THEN** the API responds 403 and nothing is deleted

#### Scenario: Confirming in the web app
- **WHEN** the platform administrator chooses to delete an organization
- **THEN** the delete stays unavailable until the organization's exact name is typed
