## RENAMED Requirements

- FROM: `### Requirement: A partner reaches its project and campaign only`
- TO: `### Requirement: A partner reaches its project and campaigns only`
- FROM: `### Requirement: Figures count the partner's campaign only`
- TO: `### Requirement: Figures count the partner's campaigns only`

## MODIFIED Requirements

### Requirement: A partner reaches its project and campaigns only

A member with the role `PARTNER` SHALL reach exactly the project of their campaigns and, in it,
only those campaigns. Every other project, client, campaign, ad set, ad and lead SHALL be answered
as not found. The project's tasks, monthly reports, documents, KPI targets, advertising
connections, share link, audit log and the organization's members and invitations SHALL be
refused with 403 or answered as not found, as for any member who may not use them. A partner
SHALL NOT change the project, its campaigns or its connections. A `PARTNER` membership bound to no
campaign SHALL be treated as no membership.

#### Scenario: The partner's project
- **WHEN** a partner of «Окна Север» and «Окна Юг» opens the projects module
- **THEN** only the project «Gealan» is listed

#### Scenario: Another project of the client
- **WHEN** a partner of «Окна Север» requests another Gealan project by its address
- **THEN** the API answers not found

#### Scenario: Another campaign of the project
- **WHEN** a partner of «Окна Север» and «Окна Юг» requests «Окна Юг» and then «Окна Восток»
- **THEN** the API returns «Окна Юг» and answers not found for «Окна Восток»

#### Scenario: Project features beyond the partner
- **WHEN** a partner of «Окна Север» requests the project's monthly reports, documents or Meta
  connections
- **THEN** the API refuses, and no content of them is returned

### Requirement: Figures count the partner's campaigns only

For a `PARTNER`, the project's summary, its tiles, its daily figures, its results by type and its
campaign table SHALL count and list only the partner's campaigns, with their ad sets and ads. Every
other member SHALL see the project's figures as before.

#### Scenario: Spend of the partner's campaign
- **WHEN** «Gealan» spent 5000 in a month, 1000 of it on «Окна Север» and 500 on «Окна Юг»
- **THEN** a partner of both campaigns sees a spend of 1500 for the month and only those two
  campaigns in the table, and an agency manager still sees 5000 and every campaign

### Requirement: The CRM board shows the partner's leads

For a `PARTNER`, the project's CRM board, its lead counts by stage and the leads' activity, notes
and files SHALL include only leads that name one of the partner's campaigns. A partner SHALL see
the board's columns and fields and SHALL create, edit and move those leads and add notes and files
to them. Every lead a partner creates SHALL name one of the partner's campaigns: a lead created
without a campaign SHALL take the partner's campaign when they hold only one, and SHALL be refused
with a request to choose one when they hold several; the lead form SHALL offer the partner's
campaigns. A partner MAY move a lead to another of their own campaigns, and SHALL NOT give a lead a
campaign they do not hold, delete a lead, or create, rename, reorder or delete a column or a field;
such requests SHALL be refused with 403, and a request about a lead they do not see SHALL be
answered as not found. A partner SHALL assign a lead only to partners who share one of their
campaigns. Leads imported for one of the partner's campaigns SHALL appear on the partner's board as
they appear on the project's board.

#### Scenario: The partner's leads
- **WHEN** the Gealan board holds 600 leads, 120 naming «Окна Север» and 80 naming «Окна Юг»
- **THEN** a partner of both campaigns sees those 200 leads and stage counts over them alone

#### Scenario: A lead taken by phone
- **WHEN** a partner of «Окна Север» and «Окна Юг» creates a lead from a phone call and picks «Окна Юг»
- **THEN** it names «Окна Юг», appears on their board and on the project's board, and the agency
  sees it

#### Scenario: No campaign picked
- **WHEN** a partner of two campaigns creates a lead without a campaign
- **THEN** the API refuses it and asks for a campaign, and a partner of one campaign gets a lead
  naming that campaign

#### Scenario: Moving a lead between the partner's campaigns
- **WHEN** a partner of «Окна Север» and «Окна Юг» moves a lead from «Окна Север» to «Окна Юг»
  and then tries «Окна Восток»
- **THEN** the first change is saved and the second is refused with 403

#### Scenario: Another campaign's lead
- **WHEN** a partner of «Окна Север» requests a lead naming «Окна Восток»
- **THEN** the API answers not found

#### Scenario: Deleting a lead
- **WHEN** a partner of «Окна Север» tries to delete one of their leads
- **THEN** the API refuses with 403 and the lead stays

#### Scenario: Changing the board
- **WHEN** a partner of «Окна Север» tries to add a column to the board
- **THEN** the API refuses with 403 and the board is unchanged

#### Scenario: A lead from a form
- **WHEN** Meta delivers a form lead from an ad of «Окна Юг»
- **THEN** it appears on the board of the partners of «Окна Юг» as soon as on the project's board

### Requirement: A partner's session, menu and landing page

The session of a `PARTNER` SHALL describe the role, the partner's campaigns and their project. The
menu SHALL offer the partner's project and, when the organization has the CRM module, the CRM, and
nothing else. After signing in, a partner SHALL land on their project's page, which SHALL show the
figures and campaign table of the partner's campaigns and no connections, KPI settings, documents,
reports, share link or activity log. Notifications SHALL concern only leads the partner sees.

#### Scenario: Signing in
- **WHEN** a partner of «Окна Север» and «Окна Юг» signs in
- **THEN** the project page of «Gealan» opens with both campaigns, and the menu shows the project
  and CRM only

#### Scenario: Agency and client unchanged
- **WHEN** an agency manager or a person of Gealan opens the same project
- **THEN** they see the project, its menu and its board exactly as before partners existed
