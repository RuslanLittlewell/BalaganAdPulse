## MODIFIED Requirements

### Requirement: Campaigns are switched by connection in tabs

When a project has a connection or campaigns imported from an advertising account, tabs
SHALL appear above the campaign table, one per account,
named by its provider and account, and sized to their names rather than the table's width.
There SHALL be no tab combining the accounts. The first account's tab SHALL be chosen when
the project opens. With more than one account, a tab SHALL show only the campaigns imported
from its account and SHALL show no totals row, because reach cannot be added up across
campaigns. With a single account its one tab SHALL be shown, and the table SHALL list every
campaign with the project's totals. With no account, no tabs SHALL be shown.

#### Scenario: Two accounts
- **WHEN** a member opens a project whose campaigns come from two Meta accounts
- **THEN** tabs Meta · first account and Meta · second account appear above the table, the first is chosen, and no Все tab is offered

#### Scenario: Switching to an account
- **WHEN** the member chooses an account's tab
- **THEN** only that account's campaigns are listed, without a totals row

#### Scenario: One account
- **WHEN** a project has a single connection and its campaigns come from it
- **THEN** its one tab is shown, and the table lists every campaign with the project's totals

#### Scenario: No account
- **WHEN** a project has no connection and no imported campaigns
- **THEN** no tabs are shown
