## ADDED Requirements

### Requirement: A Marquiz webhook can name a campaign

A Marquiz webhook address SHALL be able to name a campaign of the project after the project's
website key. A lead from such an address SHALL be created under the rules of the project address
and SHALL be linked to the named campaign, even when its `utm_campaign` names another campaign or
none. When the key's project holds no campaign with that id, the lead SHALL still be created and
SHALL be linked by `utm_campaign` as a lead from the project address is. A campaign of another
project SHALL never be linked. The project address without a campaign SHALL keep working.

When the board's project has CRM by campaign on, the Marquiz tab of the CRM integrations window
SHALL ask for a campaign of the board's project before it shows an address, and SHALL then show the
address that names the chosen campaign. The campaigns SHALL be listed with the running ones first
and SHALL be searchable. When exactly one campaign is chosen in the CRM menu, the tab SHALL open with
that campaign chosen. When the project has no campaigns, the tab SHALL say so. When the setting
is off, the tab SHALL show the project address as before.

#### Scenario: A campaign address
- **WHEN** Marquiz posts a submission with `utm_campaign=spring` to the address that names the campaign Autumn
- **THEN** the lead is linked to Autumn and still carries `utm_campaign=spring`

#### Scenario: A submission without tags
- **WHEN** Marquiz posts a submission without UTM tags to the address that names a campaign
- **THEN** the lead is linked to that campaign

#### Scenario: A campaign the project does not hold
- **WHEN** Marquiz posts a submission with `utm_campaign=spring` to an address that names a removed campaign or a campaign of another project
- **THEN** the lead is created in the key's project and linked to the project's campaign Spring

#### Scenario: Choosing a campaign in the Marquiz tab
- **WHEN** a manager opens the Marquiz tab of a project with CRM by campaign on and chooses a campaign
- **THEN** the tab shows the webhook address with the project key and that campaign, and a button that copies it

#### Scenario: A campaign chosen in the CRM menu
- **WHEN** the manager has one campaign chosen in the CRM menu and opens the Marquiz tab
- **THEN** the tab shows that campaign's address without asking

#### Scenario: The setting off
- **WHEN** a manager opens the Marquiz tab of a project with CRM by campaign off
- **THEN** the tab shows the project address without a campaign select
