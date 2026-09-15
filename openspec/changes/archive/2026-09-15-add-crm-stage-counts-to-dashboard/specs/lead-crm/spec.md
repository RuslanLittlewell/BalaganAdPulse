## ADDED Requirements

### Requirement: Period lead counts per project and fixed stage
The API SHALL report, for an inclusive `from`/`to` range of calendar days, how many leads of each project arrived within the range and are currently in each fixed stage: `NEW`, `QUALIFIED`, `TARGET` and `PROPOSAL`. A lead imported from a Meta form SHALL arrive at its form submission time; any other lead SHALL arrive at its creation time. Days SHALL be UTC calendar days. Only leads attributed to a project SHALL be counted, and leads in custom columns SHALL NOT be counted in any stage. Counts SHALL include only leads on boards the requesting member can reach, and responses SHALL carry project ids and counts only, never lead contact data. A missing, malformed or reversed range SHALL return 400.

#### Scenario: Counting arrivals by current stage
- **WHEN** a project has one lead created in the range that was moved from Новый to КП, and one lead created in the range still in Новый
- **THEN** the project's counts are one for `NEW` and one for `PROPOSAL`, and zero for `QUALIFIED` and `TARGET`

#### Scenario: Arrivals outside the range
- **WHEN** a lead was created the day before the range starts or the day after it ends
- **THEN** it is not counted

#### Scenario: A Meta lead imported after the range
- **WHEN** a Meta lead was submitted on the last day of the range and imported the next day
- **THEN** it is counted in that range

#### Scenario: Leads outside the fixed stages or projects
- **WHEN** a lead sits in a custom column, or has no project
- **THEN** it is not counted in any stage

#### Scenario: Unreachable boards
- **WHEN** a member whose grant covers only one project of a client requests counts
- **THEN** leads on that client's board are not counted for them

#### Scenario: Invalid range
- **WHEN** a request omits `to`, uses a malformed day or sets `from` after `to`
- **THEN** the API responds 400

### Requirement: The dashboard project table offers CRM stage columns
The dashboard's project table column chooser SHALL offer the columns Лид (Новый), Лид (Квалифицированный), Лид (Целевой) and Лид (КП) after the advertising figures. They SHALL be hidden until a member turns them on, and the member's choice SHALL be remembered with the table's other visible columns. Each cell SHALL show the period lead count of that project and stage for the dashboard's selected period, and 0 when there are none. Changing the period SHALL update the counts. The project page's campaign table and the campaign page's tables SHALL NOT offer these columns.

#### Scenario: Turning a stage column on
- **WHEN** a member turns on Лид (Целевой) in the dashboard project table
- **THEN** each project row shows how many of its leads that arrived in the selected period are now in Целевой

#### Scenario: Hidden by default
- **WHEN** a member who never changed the dashboard project table's columns opens the dashboard
- **THEN** the four CRM stage columns are offered in the column chooser but not shown

#### Scenario: Remembered choice
- **WHEN** a member turns on Лид (КП) and later returns to the dashboard
- **THEN** the Лид (КП) column is still shown

#### Scenario: Other tables
- **WHEN** a member opens the column chooser of a project's campaign table
- **THEN** no CRM stage columns are offered
