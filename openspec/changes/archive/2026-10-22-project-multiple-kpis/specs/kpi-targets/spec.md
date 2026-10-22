## MODIFIED Requirements

### Requirement: One KPI per organization, project and campaign
The organization and every campaign SHALL each hold at most one KPI, and a project SHALL hold up to five. A KPI SHALL be made of a metric and a positive target stored with four decimal places. The metric SHALL be one of spend, impressions, reach, clicks, leads, revenue, CTR, CPC, CPM, CPL, ROAS and frequency. Setting the KPI of the organization or of a campaign SHALL replace the previous one at that level, and clearing it SHALL leave none. KPIs of different levels SHALL be independent. Deleting a project or campaign SHALL delete its KPIs. Advertising imports SHALL NOT change KPIs.

#### Scenario: Set and replace
- **WHEN** a manager sets a campaign KPI of 50 leads and then of 20 CPL
- **THEN** the campaign holds only the CPL KPI

#### Scenario: Independent levels
- **WHEN** a campaign KPI is set
- **THEN** its project's KPIs and the organization KPI are unchanged

#### Scenario: Invalid target
- **WHEN** a request names an unknown metric or a target that is not a positive number
- **THEN** the API responds 400 and the KPIs are unchanged

#### Scenario: Import keeps the KPI
- **WHEN** a Meta import updates a campaign that has a KPI
- **THEN** the campaign's KPI is unchanged

## ADDED Requirements

### Requirement: A project holds several KPIs that can be switched off

A project SHALL hold its KPIs as an ordered list that is read and replaced as a whole. Each
KPI of the list SHALL carry an enabled flag, on unless set otherwise. A list of more than five
KPIs SHALL be refused with 400 and leave the project's KPIs unchanged. Readers and writers
SHALL be the same as for any other KPI, and each replacement SHALL record one audit event with
the list before and after.

#### Scenario: Several KPIs
- **WHEN** a manager saves a project's KPIs as 60 leads and a CPL of 20
- **THEN** the project holds both, in that order, both enabled

#### Scenario: Replacing the list
- **WHEN** a manager saves a list holding only the CPL KPI to a project that held two
- **THEN** the project holds only the CPL KPI

#### Scenario: Too many
- **WHEN** a request carries six KPIs
- **THEN** the API responds 400 and the project's KPIs are unchanged

#### Scenario: A customer
- **WHEN** a customer tries to save a project's KPIs
- **THEN** the API responds 403

### Requirement: The project dialog edits the KPIs as blocks

The KPI dialog of a project SHALL show one block per KPI, in order, each with its metric, its
target and a switch that turns the KPI on or off, and SHALL end with an empty block for adding
the next KPI as long as the project holds fewer than five. Filling the empty block SHALL make
a new empty block follow it. A block SHALL offer removing its KPI. Saving SHALL store the
filled blocks in order, ignore the empty ones and apply the switches. The dialogs of the
organization and of a campaign SHALL stay as they are.

#### Scenario: Adding a second KPI
- **WHEN** a manager opens the dialog of a project holding one KPI
- **THEN** the dialog shows that KPI's block followed by one empty block

#### Scenario: Another empty block follows
- **WHEN** the manager fills the empty block
- **THEN** a new empty block appears after it

#### Scenario: The limit
- **WHEN** a project holds five KPIs
- **THEN** the dialog offers no empty block

#### Scenario: Switching a KPI off
- **WHEN** the manager turns a block's switch off and saves
- **THEN** the KPI stays in the project, switched off

#### Scenario: Removing a KPI
- **WHEN** the manager removes a block and saves
- **THEN** the project no longer holds that KPI

### Requirement: A project shows one KPI tile per KPI

Where a project's KPI tile is shown, the project page and the page of one of its campaigns,
it SHALL show one tile for each KPI the project holds, in order, each as the KPI tile does for
a single KPI. A switched-off KPI SHALL be shown as such and SHALL carry no status. A project
without a KPI SHALL show a single tile saying that no target is set. The control that opens
the dialog SHALL be on every tile of a member allowed to change the KPIs.

#### Scenario: Two KPIs
- **WHEN** a project holds a leads KPI and a CPL KPI
- **THEN** two KPI tiles are shown, in that order

#### Scenario: A KPI switched off
- **WHEN** one of the KPIs is switched off
- **THEN** its tile says it does not count and shows no status

### Requirement: A project's result is its least-met enabled KPI

A project's result SHALL be the percentage of its enabled KPIs that is the lowest, counting
lower-is-better metrics in their favourable direction, and SHALL colour the project in the
project list, mark its row and fill its Выполнение KPI column in the dashboard's project
table, place it in a group of the dashboard's gauge, and decide the KPI-met notification, in
the zones used by each. A KPI that is switched off SHALL NOT count, and neither SHALL one whose
figure is not measured. A project with no enabled KPI that can be measured SHALL be unrated.
The KPI-met notification SHALL be sent once in a month, when every enabled KPI is met.

#### Scenario: The weakest KPI decides
- **WHEN** a project's leads KPI is at 100% and its CPL KPI at 80%
- **THEN** its result is 80% and it is a little behind

#### Scenario: A KPI switched off
- **WHEN** the CPL KPI of that project is switched off
- **THEN** its result is 100%

#### Scenario: All switched off
- **WHEN** every KPI of a project is switched off
- **THEN** the project is unrated

#### Scenario: Notification
- **WHEN** the leads KPI is met and the CPL KPI is not
- **THEN** no KPI-met notification is sent until both are met

### Requirement: A campaign's indicator uses the project's least-met KPI

When a campaign has no KPI of its own, its indicator SHALL follow the least-met of its
project's enabled KPIs that are measured by figures. A KPI set by hand and a KPI switched off
SHALL NOT count.

#### Scenario: Two project KPIs
- **WHEN** a campaign has no KPI and its project's KPIs are met by 100% and 80% by the campaign's figures
- **THEN** its indicator is yellow
