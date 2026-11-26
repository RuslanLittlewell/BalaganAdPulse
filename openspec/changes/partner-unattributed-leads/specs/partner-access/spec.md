## MODIFIED Requirements

### Requirement: The CRM board shows the partner's leads

For a `PARTNER`, the project's CRM board, its lead counts by stage and the leads' activity, notes
and files SHALL include only leads that name one of the partner's campaigns and the project's
leads that name no campaign. A partner SHALL see the board's columns and fields and SHALL create,
edit and move those leads and add notes and files to them. Every lead a partner creates SHALL name
one of the partner's campaigns: a lead created without a campaign SHALL take the partner's
campaign when they hold only one, and SHALL be refused with a request to choose one when they hold
several; the lead form SHALL offer the partner's campaigns. Editing or moving a lead that names no
campaign SHALL leave it without one unless the partner gives it one of their campaigns. A partner
MAY move a lead to another of their own campaigns, and SHALL NOT give a lead a campaign they do not
hold, delete a lead, or create, rename, reorder or delete a column or a field; such requests SHALL
be refused with 403, and a request about a lead they do not see SHALL be answered as not found. A
partner SHALL assign a lead only to partners who share one of their campaigns. Leads imported for
one of the partner's campaigns SHALL appear on the partner's board as they appear on the project's
board.

#### Scenario: The partner's leads
- **WHEN** the Gealan board holds 600 leads, 120 naming «Окна Север», 80 naming «Окна Юг», 50
  naming no campaign and the rest naming «Окна Восток»
- **THEN** a partner of «Окна Север» and «Окна Юг» sees those 250 leads and stage counts over them
  alone

#### Scenario: A lead without a campaign
- **WHEN** a quiz lead reaches «Gealan» without a campaign
- **THEN** every partner of a Gealan campaign sees it on their board and the leads of «Окна Восток»
  stay hidden from partners of other campaigns

#### Scenario: Working a lead without a campaign
- **WHEN** a partner of «Окна Север» and «Окна Юг» renames a lead that names no campaign and moves
  it to another column
- **THEN** both changes are saved and the lead still names no campaign

#### Scenario: Taking a lead without a campaign
- **WHEN** a partner of «Окна Север» gives a lead that names no campaign the campaign «Окна Север»
- **THEN** the lead names «Окна Север» and a partner of only «Окна Юг» no longer sees it

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
