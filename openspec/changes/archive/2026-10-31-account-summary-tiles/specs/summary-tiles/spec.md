## ADDED Requirements

### Requirement: Each account of a project has its own tiles
When a project's summary is split by account, which happens when the project has more than
one account, each account's tab SHALL show its own tiles in its own order, and choosing,
removing or rearranging tiles in a tab SHALL change that account's tiles alone, saved to the
server for everyone who opens the project. A tab whose tiles nobody has chosen SHALL show the
project's tiles, and its first change SHALL start from them. A project with one account or
none SHALL show and change the project's tiles.

A campaign page SHALL show the tiles of its campaign's account when that account has its own,
and the project's tiles otherwise; a campaign with no account SHALL show the project's tiles.

The API SHALL return each account's tiles alongside the project's when the project's tiles are
read, and SHALL save tiles for one account when the change names a channel and an account ID.
The same roles, limits and errors SHALL apply as to the project's tiles, a change for an
account SHALL be recorded in the audit trail with the account it concerns, and the dashboard
SHALL refuse a change that names an account with 400.

#### Scenario: Different tiles per account
- **WHEN** a project has the accounts Meta · 1 and Google · 2 and a manager adds Клики in the Google · 2 tab
- **THEN** the Google · 2 tab shows Клики, and the Meta · 1 tab still shows the project's tiles without Клики

#### Scenario: A tab nobody configured
- **WHEN** a project's tiles are Лиды and Расход and nobody has chosen tiles for its Meta · 1 account
- **THEN** the Meta · 1 tab shows Лиды and Расход

#### Scenario: Rearranging in a tab
- **WHEN** a manager moves Расход in front of Лиды in the Meta · 1 tab of that project
- **THEN** the Meta · 1 tab shows Расход then Лиды, and the project's own tiles keep Лиды first

#### Scenario: Everyone sees an account's tiles
- **WHEN** a manager adds Клики in the Google · 2 tab and a guest then opens that tab
- **THEN** the guest's summary shows Клики

#### Scenario: A campaign follows its account
- **WHEN** the Google · 2 account has the tiles CPC and Клики and anybody opens one of its campaigns
- **THEN** the campaign summary shows CPC and Клики

#### Scenario: A campaign of an account without tiles
- **WHEN** a campaign's account has no tiles of its own
- **THEN** the campaign summary shows the project's tiles

#### Scenario: A guest names an account
- **WHEN** a guest asks the API to change the tiles of one of a project's accounts
- **THEN** the API responds 403 and nothing is saved

#### Scenario: The dashboard has no accounts
- **WHEN** a member asks the API to save dashboard tiles for an account
- **THEN** the API responds 400 and the dashboard tiles are unchanged
