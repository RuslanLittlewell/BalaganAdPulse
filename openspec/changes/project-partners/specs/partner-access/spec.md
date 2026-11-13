## Purpose

Define what a partner reaches in AdPulse: the project of their campaign, the figures of that one
campaign, and the CRM leads of that campaign, and nothing else.

## ADDED Requirements

### Requirement: A partner reaches its project and campaign only

A member with the role `PARTNER` SHALL reach exactly the project of their campaign and, in it,
only that campaign. Every other project, client, campaign, ad set, ad and lead SHALL be answered as
not found. The project's tasks, monthly reports, documents, KPI targets, advertising connections,
share link, audit log and the organization's members and invitations SHALL be refused with 403 or
answered as not found, as for any member who may not use them. A partner SHALL NOT change the
project, its campaigns or its connections. A `PARTNER` membership bound to no campaign SHALL be
treated as no membership.

#### Scenario: The partner's project
- **WHEN** a partner of «Окна Север» opens the projects module
- **THEN** only the project «Gealan» is listed

#### Scenario: Another project of the client
- **WHEN** a partner of «Окна Север» requests another Gealan project by its address
- **THEN** the API answers not found

#### Scenario: Another campaign of the project
- **WHEN** a partner of «Окна Север» requests the campaign «Окна Юг»
- **THEN** the API answers not found

#### Scenario: Project features beyond the partner
- **WHEN** a partner of «Окна Север» requests the project's monthly reports, documents or Meta
  connections
- **THEN** the API refuses, and no content of them is returned

### Requirement: Figures count the partner's campaign only

For a `PARTNER`, the project's summary, its tiles, its daily figures, its results by type and its
campaign table SHALL count and list only the partner's campaign, with its ad sets and ads. Every
other member SHALL see the project's figures as before.

#### Scenario: Spend of the partner's campaign
- **WHEN** «Gealan» spent 5000 in a month, 1000 of it on «Окна Север»
- **THEN** a partner of «Окна Север» sees a spend of 1000 for the month and only that campaign in
  the table, and an agency manager still sees 5000 and every campaign

### Requirement: The CRM board shows the partner's leads

For a `PARTNER`, the project's CRM board, its lead counts by stage and the leads' activity, notes
and files SHALL include only leads that name the partner's campaign. A partner SHALL see the
board's columns and fields and SHALL create, edit and move those leads and add notes and files to
them. Every lead a partner creates SHALL name the partner's campaign, which a lead created without
a campaign SHALL take, and the lead form SHALL choose it. A partner SHALL NOT give a lead another
campaign, delete a lead, or create, rename, reorder or delete a column or a field; such requests
SHALL be refused with 403, and a request about a lead they do not see SHALL be answered as not
found. A partner SHALL assign a lead only to partners of the same campaign. Leads imported from
Meta for the partner's campaign SHALL appear on the partner's board as they appear on the project's
board.

#### Scenario: The partner's leads
- **WHEN** the Gealan board holds 600 leads, 120 of them naming «Окна Север»
- **THEN** a partner of «Окна Север» sees those 120 leads and stage counts over them alone

#### Scenario: A lead taken by phone
- **WHEN** a partner of «Окна Север» creates a lead from a phone call
- **THEN** it names «Окна Север», appears on their board and on the project's board, and the agency
  sees it

#### Scenario: Another campaign's lead
- **WHEN** a partner of «Окна Север» requests a lead naming «Окна Юг»
- **THEN** the API answers not found

#### Scenario: Deleting a lead
- **WHEN** a partner of «Окна Север» tries to delete one of their leads
- **THEN** the API refuses with 403 and the lead stays

#### Scenario: Changing the board
- **WHEN** a partner of «Окна Север» tries to add a column to the board
- **THEN** the API refuses with 403 and the board is unchanged

#### Scenario: A lead from a form
- **WHEN** Meta delivers a form lead from an ad of «Окна Север»
- **THEN** it appears on the board of the partners of «Окна Север» as soon as on the project's
  board

### Requirement: A partner sees the contacts of its leads

For a `PARTNER`, the client's people and organizations SHALL be listed and read only when they are
linked to a lead the partner sees, and searching contacts SHALL return only those. A partner SHALL
create a contact with a lead and edit the contacts of their leads, and SHALL NOT delete a contact.

#### Scenario: The partner's contact book
- **WHEN** a partner of «Окна Север» opens the people list of Gealan
- **THEN** only people linked to leads of «Окна Север» are listed

### Requirement: A partner's session, menu and landing page

The session of a `PARTNER` SHALL describe the role, the campaign and its project. The menu SHALL
offer the partner's project and, when the organization has the CRM module, the CRM, and nothing
else. After signing in, a partner SHALL land on their project's page, which SHALL show the figures
and campaign table of the partner's campaign and no connections, KPI settings, documents, reports,
share link or activity log. Notifications SHALL concern only leads the partner sees.

#### Scenario: Signing in
- **WHEN** a partner of «Окна Север» signs in
- **THEN** the project page of «Gealan» opens, and the menu shows the project and CRM only

#### Scenario: Agency and client unchanged
- **WHEN** an agency manager or a person of Gealan opens the same project
- **THEN** they see the project, its menu and its board exactly as before partners existed
