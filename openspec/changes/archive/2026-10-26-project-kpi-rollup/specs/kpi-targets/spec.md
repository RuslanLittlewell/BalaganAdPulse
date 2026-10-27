## ADDED Requirements

### Requirement: A project's result rolls up its accounts' KPIs

A project's result SHALL be the average of the progress of its shares: one share for each
advertising account named by an enabled KPI that can be measured, and one for the enabled KPIs
naming no account, when there is any. A share's progress SHALL be the average of its KPIs'
percentages, each counted at most 100% and measured as the KPI tile measures it, on the figures of
the account the KPI names, or of the whole project when it names none. A KPI that is switched off
SHALL NOT count, and neither SHALL one whose figure is not measured. A project with no enabled KPI
that can be measured SHALL be unrated. The result SHALL colour the project in the project list,
mark its row and fill its Выполнение KPI column in the dashboard's project table, chart it there
day by day, and place the project in a group of the dashboard's gauge, in the zones used by each.
Campaign KPIs SHALL NOT count. The KPI-met notification SHALL be sent once in a month, when every
enabled KPI is met.

#### Scenario: One account, two KPIs
- **WHEN** a project's one account holds a leads KPI at 100% and a CPL KPI at 60%
- **THEN** the project's result is 80%

#### Scenario: A KPI over its target
- **WHEN** the leads KPI is at 150% and the CPL KPI at 60%
- **THEN** the project's result is 80%, not 105%

#### Scenario: Two accounts
- **WHEN** a project's first account is at 100% and its second, holding two KPIs at 100% and 0%, is at 50%
- **THEN** the project's result is 75%

#### Scenario: A KPI switched off
- **WHEN** the CPL KPI at 60% is switched off
- **THEN** the project's result follows the leads KPI alone

#### Scenario: All switched off
- **WHEN** every KPI of a project is switched off
- **THEN** the project is unrated

#### Scenario: A campaign's KPI
- **WHEN** a campaign of the project holds a KPI it falls far behind
- **THEN** the project's result is unchanged

#### Scenario: Notification
- **WHEN** the leads KPI is met and the CPL KPI is not
- **THEN** no KPI-met notification is sent until both are met

## MODIFIED Requirements

### Requirement: A campaign's indicator follows its KPI

Each campaign row in a project's campaign table SHALL carry a coloured indicator decided by
the campaign's progress against its own KPI for the selected period. The project's KPIs SHALL NOT
stand in for a campaign without one. Progress SHALL be the percentage achieved as the KPI tile
computes it, counting lower-is-better metrics in their favourable direction. The indicator SHALL be:

- grey when the campaign is not running (paused, rejected or ended), when it has no KPI of its
  own, or when the KPI's figure is not measured;
- red when progress is below 70%: the campaign is far behind and needs urgent measures;
- yellow when progress is from 70% up to 90%: the campaign is somewhat behind and someone
  should look closer and help;
- green when progress is 90% or more: the plan is met or exceeded and nothing is needed.

A campaign that is learning SHALL count as running. The indicator SHALL expose its state to
assistive technology rather than through colour alone.

#### Scenario: Meeting the KPI
- **WHEN** a running campaign's KPI is 30 leads for the period and it has 30
- **THEN** its indicator is green

#### Scenario: The lower boundary of green
- **WHEN** a running campaign has 27 leads against a KPI of 30
- **THEN** its progress is 90% and its indicator is green

#### Scenario: Somewhat behind
- **WHEN** a running campaign has 24 leads against a KPI of 30
- **THEN** its indicator is yellow

#### Scenario: The lower boundary of yellow
- **WHEN** a running campaign has 21 leads against a KPI of 30
- **THEN** its progress is 70% and its indicator is yellow

#### Scenario: Far behind
- **WHEN** a running campaign has 20 leads against a KPI of 30
- **THEN** its progress is 67% and its indicator is red

#### Scenario: Lower is better
- **WHEN** a running campaign's KPI is a CPA of 10 and its CPA is 12
- **THEN** its progress is 83% and its indicator is yellow

#### Scenario: The project's KPI stands in
- **WHEN** a running campaign has no KPI and the project's KPI is met by its figures
- **THEN** its indicator is grey, because the project's KPI no longer stands in

#### Scenario: Not running
- **WHEN** a campaign is paused, whatever its figures
- **THEN** its indicator is grey

#### Scenario: No KPI anywhere
- **WHEN** neither a running campaign nor its project has a KPI
- **THEN** its indicator is grey

### Requirement: A project KPI can belong to an advertising account

A project KPI SHALL either name one advertising account, by its provider and account id, or name
none. A KPI that names an account SHALL be measured only on the figures of the project's campaigns
imported from that account, wherever it is measured: its tile, the project's result, the
dashboard's trend of it and the KPI-met notification. A KPI that names no account SHALL belong to
the project and be measured on the figures of all its campaigns. A KPI naming an account from which
the project has no campaign SHALL be measured on no figures. A KPI set by hand SHALL be compared as
it is, whatever account it names. Reading a project's KPIs SHALL return each KPI's account or null,
and the audit event of a replacement SHALL carry each KPI's account. KPIs that named no account in a
project with exactly one account, among its connections and imported campaigns, SHALL be moved to
that account once; KPIs stored afterwards keep what they name.

#### Scenario: Two accounts measured apart
- **WHEN** a project's first account recorded 40 leads and its second 30, and the project holds a KPI of leads naming the first account
- **THEN** that KPI is measured on 40 leads

#### Scenario: A common KPI
- **WHEN** the same project holds a KPI of leads that names no account
- **THEN** that KPI is measured on 70 leads

#### Scenario: An account without campaigns
- **WHEN** a KPI of leads names an account from which the project has no campaign
- **THEN** that KPI is measured on 0 leads

#### Scenario: Moved to the only account
- **WHEN** a project with one account held a KPI naming no account before the move
- **THEN** the KPI names that account

### Requirement: A project holds several KPIs that can be switched off

A project SHALL hold its KPIs as an ordered list that is read and replaced as a whole. Each
KPI of the list SHALL carry an enabled flag, on unless set otherwise. A list in which more than five
KPIs name the same account, or more than five name no account, SHALL be refused with 400 and leave
the project's KPIs unchanged. Readers and writers SHALL be the same as for any other KPI, and each
replacement SHALL record one audit event with the list before and after.

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
- **WHEN** a request carries six KPIs naming the same account
- **THEN** the API responds 400 and the project's KPIs are unchanged

#### Scenario: Five for each account
- **WHEN** a request carries five KPIs naming no account and five naming each of two accounts
- **THEN** the project holds all fifteen

#### Scenario: A customer
- **WHEN** a customer tries to save a project's KPIs
- **THEN** the API responds 403

### Requirement: The project dialog edits the KPIs as blocks

The KPI dialog of a project SHALL show one block per KPI it edits, in order, each with its metric,
its target and a switch that turns the KPI on or off, and one empty block when it edits none. It
SHALL offer a plus control after the last block that adds an empty block, as long as it holds fewer
than five blocks and the last block is not itself empty. No block SHALL be added by filling another.
A block SHALL offer removing its KPI. Saving SHALL store the filled blocks in order, ignore the
empty ones, apply the switches and keep every KPI the dialog does not edit. In a project with more
than one account, the dialog SHALL edit the KPIs naming the chosen tab's account and those naming no
account, and a KPI added in it SHALL name that account. In a project with one account it SHALL edit
every KPI of the project, a KPI added in it naming that account; with no account, every KPI, naming
none. No block SHALL offer a choice of account, and a KPI SHALL keep the account it names. The
dialogs of the organization and of a campaign SHALL stay as they are.

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
- **WHEN** the dialog on an account's tab holds a KPI naming no account and the manager saves it
- **THEN** that KPI still names no account

#### Scenario: One account
- **WHEN** a manager adds a KPI in a project with a single account
- **THEN** the KPI names that account, and no block offers a choice of account

### Requirement: A project shows one KPI tile per KPI

The project page's summary SHALL show one tile for each KPI it holds, in order, each as the KPI
tile does for a single KPI. In a project with one account or none it SHALL hold every KPI of the
project, measured on the project's figures. In a project with more than one account it SHALL follow
the chosen tab: the KPIs naming that account, measured on its figures, and the KPIs naming no
account, measured on the project's figures and marked «Весь проект». Every tile and every preview of
one in the KPI dialog SHALL carry a small circle at its top left, green when the KPI counts toward
the project's result and grey when it is switched off, and the circle SHALL be named for assistive
technology. A switched-off KPI SHALL otherwise be drawn like any other. A summary without a KPI
SHALL show a single tile saying that no target is set. The control that opens the dialog SHALL be on
every tile of a member allowed to change the KPIs.

#### Scenario: Two KPIs
- **WHEN** a project with one account holds a leads KPI and a CPL KPI
- **THEN** two KPI tiles are shown, in that order, each with a green circle

#### Scenario: A KPI switched off
- **WHEN** one of the KPIs is switched off
- **THEN** its tile carries a grey circle and keeps its figures and status

#### Scenario: Switching accounts
- **WHEN** a project with two accounts holds a leads KPI naming each, and the member chooses the second account's tab
- **THEN** the summary shows the second account's leads KPI measured on its leads

#### Scenario: An account without KPIs
- **WHEN** the member chooses the tab of an account no KPI names, and no KPI names no account
- **THEN** the summary shows a single tile saying no target is set

#### Scenario: A KPI of the whole project
- **WHEN** a project with two accounts holds a KPI naming no account
- **THEN** every account's tab shows it in the summary, measured on the project's figures and marked «Весь проект»

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
- **THEN** the tile says no target is set and the campaign's indicator turns grey

## REMOVED Requirements

### Requirement: A project's result is its least-met enabled KPI
**Reason**: The project's result is now the average of its accounts' shares, each the average of its KPIs.
**Migration**: See «A project's result rolls up its accounts' KPIs».

### Requirement: A campaign's indicator uses the project's least-met KPI
**Reason**: Campaign KPIs are the media buyer's own notes; a campaign without one is grey.
**Migration**: Set a KPI on the campaign to colour its indicator.
