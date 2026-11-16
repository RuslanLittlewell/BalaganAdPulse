## ADDED Requirements

### Requirement: The CRM can be scoped to one campaign

When the member's CRM by campaign preference is on, the CRM menu column SHALL show a campaign select directly under the board picker. It SHALL list the campaigns of the selected board's project and an option for all campaigns, which is selected by default. Choosing a campaign SHALL limit the leads shown on the board, in the table and in the tasks view, and the lead count of the section Лиды, to leads of that campaign. The choice SHALL be kept in the address and SHALL be cleared when the board changes. When the preference is off, the select SHALL NOT appear and no campaign scope SHALL apply, even if the address names one.

#### Scenario: Choosing a campaign
- **WHEN** a member with the preference on selects a campaign under the board picker
- **THEN** only that campaign's leads appear in the board, table and tasks views

#### Scenario: Returning to all campaigns
- **WHEN** the member picks the all campaigns option
- **THEN** every lead of the board is shown again

#### Scenario: Changing the board
- **WHEN** the member chooses another board while a campaign is selected
- **THEN** the campaign select shows all campaigns for the new board

#### Scenario: Preference off
- **WHEN** the preference is off
- **THEN** the CRM menu column has no campaign select
