## MODIFIED Requirements

### Requirement: Campaigns are switched by connection in tabs

When a project has a connection, campaigns imported from an advertising account, a KPI naming
an account, or a connected site, tabs SHALL appear above the campaign table: one per account,
named by its provider and account, and then one per connected site, named SEO · and the site.
Tabs SHALL be sized to their names rather than the table's width. There SHALL be no tab
combining the accounts. The first tab SHALL be chosen when the project opens for the first
time, and afterwards the tab the member last chose on that project SHALL be chosen, also after
the member returns from a campaign, as long as it is still one of the project's tabs. With more
than one account, the chosen account's tab SHALL switch the project's one summary above to the
figures of the campaigns imported from its account and to its KPIs, and the campaign table to
only its campaigns, with a totals row of those campaigns; no other summary SHALL be added. With
a single account its one tab SHALL be shown, the summary SHALL show the project, and the table
SHALL list every campaign with their totals. Site tabs SHALL NOT count as accounts for these
rules. Choosing a site's tab SHALL switch the summary above to the site's search tiles and
replace the KPI strip, the running-only switch and the campaign table with the site's SEO view.
With no account and no site, no tabs SHALL be shown.

#### Scenario: Two accounts
- **WHEN** a member opens a project whose campaigns come from two Meta accounts
- **THEN** tabs Meta · first account and Meta · second account appear above the table, the first is chosen, and no Все tab is offered

#### Scenario: Switching to an account
- **WHEN** the member chooses an account's tab
- **THEN** the summary above shows that account's figures and KPIs, and the table lists only its campaigns with a totals row of those campaigns

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
- **THEN** its one tab is shown, the summary shows the project, and the table lists every campaign with their totals

#### Scenario: An account named only by a KPI
- **WHEN** a project's campaigns come from one account and a KPI names another
- **THEN** a tab is shown for each of the two accounts

#### Scenario: No account
- **WHEN** a project has no connection, no imported campaigns and no KPI naming an account
- **THEN** no tabs are shown

#### Scenario: An account and a site
- **WHEN** a project has one Meta account and the connected site site.ru
- **THEN** tabs Meta · account and SEO · site.ru are shown, and the Meta tab's summary shows the project

#### Scenario: Choosing the site
- **WHEN** the member chooses SEO · site.ru
- **THEN** the summary shows the site's search tiles, the campaign table gives way to the site's SEO view, and the tab is still chosen when the member comes back to the project

