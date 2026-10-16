## ADDED Requirements

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
