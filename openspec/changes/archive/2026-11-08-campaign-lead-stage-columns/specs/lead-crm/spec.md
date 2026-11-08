## ADDED Requirements

### Requirement: Period lead counts per campaign, ad set and ad
The API SHALL report, for one project's board and an inclusive `from`/`to` range of calendar days, how many of that project's leads arrived within the range and are currently in each fixed stage `NEW`, `QUALIFIED`, `TARGET` and `PROPOSAL`, grouped three ways: by the campaign the lead names, by the ad set of the ad the lead names, and by that ad. Arrival time, UTC calendar days and the exclusion of leads in custom columns SHALL follow the period lead counts per project. A lead that names no campaign SHALL count in no campaign. A lead that names no ad SHALL count in no ad set and no ad, and SHALL still count for the campaign it names. Only campaigns, ad sets and ads with at least one counted lead SHALL be listed. A board the member cannot reach SHALL answer 404, and so SHALL every request while the organization's CRM module is off. Responses SHALL carry ids and counts only, never lead contact data. A missing, malformed or reversed range SHALL return 400.

#### Scenario: Counting by campaign, ad set and ad
- **WHEN** in the range campaign Весна brought one lead through ad Видео 1 of ad set Москва that is now in Целевой, and one lead naming Весна but no ad that is still in Новый
- **THEN** Весна counts one `TARGET` and one `NEW`, Москва and Видео 1 each count one `TARGET` and no `NEW`, and every other stage is zero

#### Scenario: A lead created by hand
- **WHEN** a member created a lead in the range on the board, named no campaign and moved it to КП
- **THEN** no campaign, ad set or ad counts it

#### Scenario: Leads the project counts leave out
- **WHEN** a lead of campaign Весна sits in a custom column, or arrived the day after the range ends
- **THEN** Весна does not count it

#### Scenario: A Meta lead imported after the range
- **WHEN** a lead of campaign Весна was submitted on the last day of the range and imported the next day
- **THEN** Весна counts it

#### Scenario: Another project's board
- **WHEN** a member whose grant covers only project A requests the counts of project B's board
- **THEN** the API responds 404

#### Scenario: CRM module off
- **WHEN** a member of an organization whose CRM module is off requests the counts
- **THEN** the API responds 404

#### Scenario: Invalid range
- **WHEN** a request omits `from`, uses a malformed day or sets `from` after `to`
- **THEN** the API responds 400

### Requirement: The campaign tables offer CRM stage columns
The column chooser of a project's campaign table and of a campaign's ad set table SHALL offer the columns Квал. лид, Целевой лид and КП, counting the fixed stages `QUALIFIED`, `TARGET` and `PROPOSAL`, after the table's advertising and result figures. They SHALL NOT offer a column for `NEW`. The columns SHALL be hidden until a member turns them on, and the member's choice SHALL be remembered with the table's other columns, for each advertising account apart as the rest of the table's layout is. Each campaign row SHALL show the period lead counts of that campaign, each ad set row those of the ad set and each ad row those of the ad, for the selected period, and 0 when there are none. The campaign table's totals row SHALL show the sum of the campaigns it lists. Changing the period SHALL update the counts. While the organization's CRM module is off, neither table SHALL offer these columns.

#### Scenario: Turning a stage column on in the campaign table
- **WHEN** a member turns on Квал. лид in a project's campaign table and campaign Весна has two leads that arrived in the selected period and are now in Квалифицированный
- **THEN** Весна's row shows 2 under Квал. лид

#### Scenario: Ad set and ad rows
- **WHEN** a member turns on Целевой лид on campaign Весна's page, and ad Видео 1 of ad set Москва brought one lead in the selected period that is now in Целевой
- **THEN** Москва's row shows 1 under Целевой лид, and so does Видео 1's row once Москва is expanded

#### Scenario: The totals row
- **WHEN** the campaign table lists two campaigns showing 2 and 3 under КП
- **THEN** the totals row shows 5 under КП

#### Scenario: A lead created by hand
- **WHEN** a project's only lead in КП was created by hand on its board
- **THEN** every campaign row and the totals row show 0 under КП

#### Scenario: Hidden by default
- **WHEN** a member who never changed a campaign table's columns opens it
- **THEN** Квал. лид, Целевой лид and КП are offered in the column chooser but not shown, and no column for Новый is offered

#### Scenario: CRM module off
- **WHEN** a member of an organization whose CRM module is off opens a campaign table's column chooser
- **THEN** no CRM stage column is offered

## MODIFIED Requirements

### Requirement: The dashboard project table offers CRM stage columns
The dashboard's project table column chooser SHALL offer the columns Лид (Новый), Квал. лид, Целевой лид and КП, counting the fixed stages `NEW`, `QUALIFIED`, `TARGET` and `PROPOSAL` in that order, after the advertising figures. They SHALL be hidden until a member turns them on, and the member's choice SHALL be remembered with the table's other visible columns. A choice saved while the columns were named Лид (Квалифицированный), Лид (Целевой) and Лид (КП) SHALL keep applying to Квал. лид, Целевой лид and КП. Each cell SHALL show the period lead count of that project and stage for the dashboard's selected period, and 0 when there are none. Changing the period SHALL update the counts.

#### Scenario: Turning a stage column on
- **WHEN** a member turns on Целевой лид in the dashboard project table
- **THEN** each project row shows how many of its leads that arrived in the selected period are now in Целевой

#### Scenario: Hidden by default
- **WHEN** a member who never changed the dashboard project table's columns opens the dashboard
- **THEN** the four CRM stage columns are offered in the column chooser but not shown

#### Scenario: Remembered choice
- **WHEN** a member turns on КП and later returns to the dashboard
- **THEN** the КП column is still shown

#### Scenario: A choice saved under the earlier names
- **WHEN** a member turned on Лид (Целевой) before the columns were renamed and opens the dashboard afterwards
- **THEN** the Целевой лид column is shown

#### Scenario: Other tables
- **WHEN** a member opens the column chooser of a project's campaign table
- **THEN** Квал. лид, Целевой лид and КП are offered and Лид (Новый) is not
