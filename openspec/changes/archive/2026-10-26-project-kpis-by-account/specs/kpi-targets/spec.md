## ADDED Requirements

### Requirement: A project KPI can belong to an advertising account

A project KPI SHALL either name one advertising account, by its provider and account id, or name
none. A KPI that names an account SHALL be measured only on the figures of the project's campaigns
imported from that account, wherever it is measured: its tile, the project's result, the
dashboard's trend of it, the KPI-met notification and the indicators of campaigns. A KPI that names
no account SHALL be common to the project and measured on the figures of all its campaigns. A KPI
naming an account from which the project has no campaign SHALL be measured on no figures. A KPI
set by hand SHALL be compared as it is, whatever account it names. Reading a project's KPIs SHALL
return each KPI's account or null, and the audit event of a replacement SHALL carry each KPI's
account. KPIs stored before accounts could be named SHALL name none.

#### Scenario: Two accounts measured apart
- **WHEN** a project's first account recorded 40 leads and its second 30, and the project holds a KPI of leads naming the first account
- **THEN** that KPI is measured on 40 leads

#### Scenario: A common KPI
- **WHEN** the same project holds a KPI of leads that names no account
- **THEN** that KPI is measured on 70 leads

#### Scenario: An account without campaigns
- **WHEN** a KPI of leads names an account from which the project has no campaign
- **THEN** that KPI is measured on 0 leads

## MODIFIED Requirements

### Requirement: A project holds several KPIs that can be switched off

A project SHALL hold its KPIs as an ordered list that is read and replaced as a whole. Each
KPI of the list SHALL carry an enabled flag, on unless set otherwise. A list in which more than five
KPIs count toward one account, the KPIs naming it and those naming no account, or in which more than
five KPIs name no account, SHALL be refused with 400 and leave the project's KPIs unchanged. Readers
and writers SHALL be the same as for any other KPI, and each replacement SHALL record one audit
event with the list before and after.

#### Scenario: Several KPIs
- **WHEN** a manager saves a project's KPIs as 60 leads and a CPL of 20
- **THEN** the project holds both, in that order, both enabled

#### Scenario: Replacing the list
- **WHEN** a manager saves a list holding only the CPL KPI to a project that held two
- **THEN** the project holds only the CPL KPI

#### Scenario: Too many
- **WHEN** a request carries six KPIs naming no account
- **THEN** the API responds 400 and the project's KPIs are unchanged

#### Scenario: Too many for one account
- **WHEN** a request carries two common KPIs and four naming the same account
- **THEN** the API responds 400 and the project's KPIs are unchanged

#### Scenario: Five for each account
- **WHEN** a request carries one common KPI and four naming each of two accounts
- **THEN** the project holds all nine

#### Scenario: A customer
- **WHEN** a customer tries to save a project's KPIs
- **THEN** the API responds 403

### Requirement: The project dialog edits the KPIs as blocks

The KPI dialog of a project SHALL show one block per KPI, in order, each with its metric, its
target and a switch that turns the KPI on or off, and one empty block when the project holds no
KPI. It SHALL offer a plus control after the last block that adds an empty block, as long as the
dialog holds fewer than five blocks and the last block is not itself empty. No block SHALL be
added by filling another. A block SHALL offer removing its KPI. Saving SHALL store the filled
blocks in order, ignore the empty ones and apply the switches. In a project with more than one
advertising account, the dialog opened on an account's tab SHALL show only the KPIs naming that
account and the common ones, each block SHALL offer a «Кабинет» choice of the project's accounts
and «Все кабинеты», a block added in it SHALL name that account, and saving SHALL keep the KPIs
naming other accounts as they were. In a project with at most one account, the dialog SHALL offer
no such choice. The dialogs of the organization and of a campaign SHALL stay as they are.

#### Scenario: Adding a second KPI
- **WHEN** a manager opens the dialog of a project holding one KPI and presses the plus control
- **THEN** an empty block follows that KPI's block

#### Scenario: Filling a block adds nothing
- **WHEN** the manager fills the empty block
- **THEN** no other block appears until the plus control is pressed

#### Scenario: Another empty block follows
- **WHEN** the manager has filled the empty block and presses the plus control
- **THEN** a new empty block appears after it

#### Scenario: One empty block at a time
- **WHEN** the last block is empty
- **THEN** the plus control is disabled

#### Scenario: The limit
- **WHEN** the dialog holds five blocks
- **THEN** it offers no plus control

#### Scenario: Switching a KPI off
- **WHEN** the manager turns a block's switch off and saves
- **THEN** the KPI stays in the project, switched off

#### Scenario: Removing a KPI
- **WHEN** the manager removes a block and saves
- **THEN** the project no longer holds that KPI

#### Scenario: A KPI for the chosen account
- **WHEN** a manager on the second account's tab of a project with two accounts adds a KPI of 30 leads and saves
- **THEN** the KPI names the second account, and the first account's KPIs are unchanged

#### Scenario: Making a KPI common
- **WHEN** the manager chooses «Все кабинеты» in a block and saves
- **THEN** the KPI names no account and is shown on every account's tab

#### Scenario: One account
- **WHEN** a manager opens the dialog of a project with a single account
- **THEN** no block offers a «Кабинет» choice

### Requirement: A project shows one KPI tile per KPI

Where a project's KPI tile is shown, the project page and the page of one of its campaigns,
it SHALL show one tile for each KPI the project holds, in order, each as the KPI tile does for
a single KPI. On the project page of a project with more than one advertising account, it SHALL
show only the KPIs naming the chosen account's tab, measured on that account's figures, and the
common ones, measured on the whole project's figures and marked «Все кабинеты». Every tile and every
preview of one in the KPI dialog SHALL carry a small circle at its top left, green when the KPI
counts toward the project's result and grey when it is switched off, and the circle SHALL be named
for assistive technology. A switched-off KPI SHALL otherwise be drawn like any other. A project, or
an account's tab, without a KPI SHALL show a single tile saying that no target is set. The control
that opens the dialog SHALL be on every tile of a member allowed to change the KPIs.

#### Scenario: Two KPIs
- **WHEN** a project holds a leads KPI and a CPL KPI
- **THEN** two KPI tiles are shown, in that order, each with a green circle

#### Scenario: A KPI switched off
- **WHEN** one of the KPIs is switched off
- **THEN** its tile carries a grey circle and keeps its figures and status

#### Scenario: Switching accounts
- **WHEN** a project with two accounts holds a leads KPI naming each and a common CPL KPI, and the member chooses the second account's tab
- **THEN** the second account's leads KPI, measured on its leads, and the CPL KPI marked «Все кабинеты» are shown

#### Scenario: An account without KPIs
- **WHEN** the member chooses the tab of an account no KPI names, and the project holds no common KPI
- **THEN** a single tile says no target is set

### Requirement: A project's result is its least-met enabled KPI

A project's result SHALL be the percentage of its enabled KPIs that is the lowest, counting
lower-is-better metrics in their favourable direction and measuring each KPI on the figures of
the account it names, or of the whole project when it names none, and SHALL colour the project in
the project list, mark its row and fill its Выполнение KPI column in the dashboard's project
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

#### Scenario: Accounts measured apart
- **WHEN** a project's first account met its leads KPI and its second account reached 50% of its own
- **THEN** the project's result is 50%

### Requirement: A campaign's indicator uses the project's least-met KPI

When a campaign has no KPI of its own, its indicator SHALL follow the least-met of its
project's enabled KPIs that are measured by figures and that name the campaign's account or no
account. A KPI set by hand, a KPI switched off and a KPI naming another account SHALL NOT count.

#### Scenario: Two project KPIs
- **WHEN** a campaign has no KPI and its project's KPIs are met by 100% and 80% by the campaign's figures
- **THEN** its indicator is yellow

#### Scenario: Another account's KPI
- **WHEN** a campaign of the first account has no KPI, and the only project KPI names the second account
- **THEN** its indicator is grey
