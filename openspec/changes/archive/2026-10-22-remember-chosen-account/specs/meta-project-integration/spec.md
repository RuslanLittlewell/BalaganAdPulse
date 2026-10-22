## MODIFIED Requirements

### Requirement: Campaigns are switched by connection in tabs

When a project has a connection or campaigns imported from an advertising account, tabs
SHALL appear above the campaign table, one per account,
named by its provider and account, and sized to their names rather than the table's width.
There SHALL be no tab combining the accounts. The first account's tab SHALL be chosen when
the project opens for the first time, and afterwards the account the member last chose on that
project SHALL be chosen, also after the member returns from a campaign, as long as it is still
one of the project's accounts. With more than one account, a tab SHALL show only the campaigns imported
from its account and SHALL show no totals row, because reach cannot be added up across
campaigns. With a single account its one tab SHALL be shown, and the table SHALL list every
campaign with the project's totals. With no account, no tabs SHALL be shown.

#### Scenario: Two accounts
- **WHEN** a member opens a project whose campaigns come from two Meta accounts
- **THEN** tabs Meta · first account and Meta · second account appear above the table, the first is chosen, and no Все tab is offered

#### Scenario: Switching to an account
- **WHEN** the member chooses an account's tab
- **THEN** only that account's campaigns are listed, without a totals row

#### Scenario: Coming back from a campaign
- **WHEN** the member chooses the second account, opens one of its campaigns and returns to the project
- **THEN** the second account's tab is chosen and its campaigns are listed

#### Scenario: Another project
- **WHEN** the member chose the second account on one project and opens a different project
- **THEN** that project's first account is chosen

#### Scenario: A remembered account that is gone
- **WHEN** the account the member chose is no longer among the project's accounts
- **THEN** the first account is chosen

#### Scenario: One account
- **WHEN** a project has a single connection and its campaigns come from it
- **THEN** its one tab is shown, and the table lists every campaign with the project's totals

#### Scenario: No account
- **WHEN** a project has no connection and no imported campaigns
- **THEN** no tabs are shown
