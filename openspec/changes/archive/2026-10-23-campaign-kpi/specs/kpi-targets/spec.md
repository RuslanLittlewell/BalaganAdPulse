## ADDED Requirements

### Requirement: The campaign page sets the campaign's KPI

The campaign's KPI tile SHALL open the campaign's KPI dialog, which SHALL offer the metrics, the
results and cost of each of the campaign's result types, a target and, when the campaign holds a
KPI, a control to clear it. It SHALL NOT offer a KPI set by hand. Saving or clearing SHALL replace
the campaign's KPI, and the campaign's indicator in the project's campaign table SHALL follow the
new KPI without reloading the page.

#### Scenario: Setting a campaign KPI
- **WHEN** a manager opens a campaign without a KPI, presses «Задать цель», picks Лиды and a target of 40 and saves
- **THEN** the campaign holds a KPI of 40 leads and its tile shows the campaign's leads against it

#### Scenario: A typed target
- **WHEN** the campaign optimises for messages and the manager opens its KPI dialog
- **THEN** results of messages and the cost of a message are offered

#### Scenario: Clearing it
- **WHEN** the manager clears the campaign's KPI
- **THEN** the tile says no target is set and the campaign's indicator follows the project's KPIs again

### Requirement: Campaign KPI blocks above the campaign table

Above a project's campaign table, after the account tabs and the running-only switch, the project
page SHALL show one block for each campaign the table lists that holds a KPI of its own, in the
table's order, and nothing when no listed campaign holds one. A block SHALL show the campaign's
name, the KPI's title, the percentage of the target reached in the selected period, or a dash when
it is not measured, a bar of that progress and the campaign's indicator colour, exposed as the
indicator's state. Hovering or focusing a block SHALL highlight that campaign's row in the table,
bringing it into the table's scrolled window when needed, and pressing it SHALL open the campaign's
page with the same period.

#### Scenario: Two campaigns with a KPI
- **WHEN** a project lists three campaigns and two of them hold a KPI of their own
- **THEN** two blocks are shown above the table, in the table's order

#### Scenario: Hovering a block
- **WHEN** a member hovers the block of a campaign
- **THEN** that campaign's row is highlighted and no other is

#### Scenario: Leaving it
- **WHEN** the pointer leaves the block
- **THEN** no row is highlighted

#### Scenario: Opening a campaign
- **WHEN** a member presses a block
- **THEN** the campaign's page opens with the period in the address

#### Scenario: A paused campaign
- **WHEN** the running-only switch is off and a paused campaign holds a KPI
- **THEN** its block is shown grey, like its indicator

#### Scenario: Another account
- **WHEN** a project's campaigns come from two accounts and the first account's tab is chosen
- **THEN** only the blocks of that account's campaigns are shown
