## MODIFIED Requirements

### Requirement: Campaigns are switched by connection in tabs

When a project has a connection, campaigns imported from an advertising account or a KPI naming
an account, tabs SHALL appear above the project's metrics, one per account,
named by its provider and account, and sized to their names rather than the table's width.
There SHALL be no tab combining the accounts. The first account's tab SHALL be chosen when
the project opens for the first time, and afterwards the account the member last chose on that
project SHALL be chosen, also after the member returns from a campaign, as long as it is still
one of the project's accounts. With more than one account, a tab SHALL show the figures of the
campaigns imported from its account in the summary tiles, the KPIs naming its account and the
common ones in the KPI tiles, and only its campaigns in the campaign table, with a totals row of
those campaigns. With a single account its one tab SHALL be shown, and the summary tiles, the KPI
tiles and the table SHALL show the whole project. With no account, no tabs SHALL be shown.

#### Scenario: Two accounts
- **WHEN** a member opens a project whose campaigns come from two Meta accounts
- **THEN** tabs Meta · first account and Meta · second account appear above the metrics, the first is chosen, and no Все tab is offered

#### Scenario: Switching to an account
- **WHEN** the member chooses an account's tab
- **THEN** the summary tiles show that account's figures, the KPI tiles its KPIs and the common ones, and the table only its campaigns with a totals row of those campaigns

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
- **THEN** its one tab is shown, and the tiles and the table show the whole project

#### Scenario: An account named only by a KPI
- **WHEN** a project's campaigns come from one account and a KPI names another
- **THEN** a tab is shown for each of the two accounts

#### Scenario: No account
- **WHEN** a project has no connection, no imported campaigns and no KPI naming an account
- **THEN** no tabs are shown
