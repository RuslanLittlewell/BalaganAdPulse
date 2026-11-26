## MODIFIED Requirements

### Requirement: A partner's session, menu and landing page

The session of a `PARTNER` SHALL describe the role, the partner's campaigns and their project.
When the organization has the CRM module, the menu SHALL offer the CRM and nothing else, a partner
SHALL land on the CRM after signing in, and an address of the projects module SHALL take the
partner to the CRM. When the organization has no CRM module, the menu SHALL offer the partner's
project and nothing else, and a partner SHALL land on their project's page. The project page, when
shown to a partner, SHALL show the figures and campaign table of the partner's campaigns and no
connections, KPI settings, documents, reports, share link or activity log. Notifications SHALL
concern only leads the partner sees.

#### Scenario: Signing in
- **WHEN** a partner of «Окна Север» and «Окна Юг» signs in to an organization with the CRM module
- **THEN** the CRM opens on the Gealan board, and the menu shows the CRM only

#### Scenario: Opening a project address
- **WHEN** that partner opens the address of the Gealan project page or of the campaign «Окна Север»
- **THEN** the CRM opens instead

#### Scenario: No CRM module
- **WHEN** a partner signs in to an organization without the CRM module
- **THEN** the project page of «Gealan» opens with the partner's campaigns, and the menu shows the
  project only

#### Scenario: Agency and client unchanged
- **WHEN** an agency manager or a person of Gealan opens the same project
- **THEN** they see the project, its menu and its board exactly as before partners existed
