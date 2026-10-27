# kpi-targets Specification

## Purpose
Give the organization, each project and each campaign one measurable goal, a metric and a target, so that the period summary can show how the actual figure compares with it.

## Requirements

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

### Requirement: Who reads and sets a KPI
A project or campaign KPI SHALL be readable by every member who reaches that project or campaign, and settable or clearable by agency members whose role may manage KPIs. Customers SHALL NOT set or clear KPIs, even on projects they may edit. The organization KPI SHALL be readable, settable and clearable only by members who reach the whole organization and may update it. Unreachable projects and campaigns SHALL answer 404; a reachable level the member may not change SHALL answer 403. Every set and clear SHALL record an audit event naming the level, the metric and the target before and after.

#### Scenario: A client reads their project's KPI
- **WHEN** a client reads the KPI of their own project
- **THEN** it is returned

#### Scenario: A client changes a KPI
- **WHEN** a client tries to set their project's KPI
- **THEN** the API responds 403

#### Scenario: A manager and the organization KPI
- **WHEN** a manager requests or sets the organization KPI
- **THEN** the API responds 403

#### Scenario: Audited change
- **WHEN** a manager sets a campaign KPI
- **THEN** an audit event records the campaign, the metric and the previous and new targets

### Requirement: Targets follow the reporting period
For spend, impressions, reach, clicks, leads and revenue, the target SHALL be a monthly amount. It SHALL be compared with the period total after prorating: each day of the selected period contributes the target divided by the number of days in that day's calendar month. For CTR, CPC, CPM, CPL, ROAS and frequency, the target SHALL be compared with the period value as it is. CPC, CPM, CPL and frequency SHALL be met when the actual value is at or below the target; every other metric SHALL be met when it is at or above.

#### Scenario: A full month
- **WHEN** a project with a KPI of 60 leads a month is read for all of September
- **THEN** its target for the period is 60

#### Scenario: A week
- **WHEN** the same project is read for seven days of September
- **THEN** its target for the period is 14

#### Scenario: A period across two months
- **WHEN** the period covers the last day of August and the first day of September
- **THEN** the target is 60/31 + 60/30

#### Scenario: Lower is better
- **WHEN** a campaign's KPI is a CPL of 20 and its CPL for the period is 18
- **THEN** the KPI is met

### Requirement: The KPI tile shows the goal against the figure
The KPI tile SHALL name the level's metric and show the actual figure for the period, the target for the period, the percentage achieved and a progress indicator, exposing whether the KPI is exceeded, met, not met or not measurable. A KPI SHALL be exceeded when the actual figure is strictly better than the period target, and met when it equals it. The percentage SHALL be actual over target, or target over actual for metrics that are better lower. A ratio with no measured value SHALL be not measurable rather than zero. The tile SHALL write a status only when the KPI is met, as Выполнено, or exceeded, as Выполнено+; it SHALL write no status when the KPI is not met or not measurable. While the KPI is exceeded, the progress indicator SHALL be animated, except for members who ask their system to reduce motion. Without a KPI, the tile SHALL say that no target is set and, for members allowed to change it, offer to set one. Members allowed to change the KPI SHALL be able to open a dialog from the tile to choose the metric and target, see whether the target is monthly or applies as it is, save it, or clear it.

#### Scenario: A KPI being exceeded
- **WHEN** a project with a KPI of 60 leads a month recorded 45 leads in half of September
- **THEN** the tile shows 45 against 30, 150%, the status Выполнено+ and an animated progress indicator

#### Scenario: A KPI met exactly
- **WHEN** the same project recorded 30 leads in half of September
- **THEN** the tile shows 100% and the status Выполнено, with a progress indicator that is not animated

#### Scenario: A KPI falling behind
- **WHEN** a campaign's KPI is a CPL of 20 and its CPL for the period is 25
- **THEN** the tile shows 80% and writes no status

#### Scenario: No target yet
- **WHEN** a manager views a project without a KPI
- **THEN** the tile says no target is set and offers Задать цель

#### Scenario: A reader
- **WHEN** a guest views a project with a KPI
- **THEN** the tile shows the KPI without controls to change it

#### Scenario: Not measurable
- **WHEN** a campaign's KPI is a CPL target and the period has no leads
- **THEN** the tile shows no figure, no progress indicator and no status

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

### Requirement: A project KPI can be set by hand

Besides a KPI on a measured metric, a project SHALL be able to hold a KPI set by hand,
made of a name, a value and a target. The name SHALL be non-empty after trimming and at
most 100 characters; the value SHALL be zero or a positive number and the target a
positive number, both stored with four decimal places. It SHALL be the project's one KPI:
setting it SHALL replace a metric KPI, and setting a metric KPI SHALL replace it. Only a
project SHALL hold one; a request to set a KPI by hand on the organization or a campaign
SHALL be refused with 400. Who may read, set and clear it, and the audit of every change,
SHALL be as for any project KPI, the audit naming its name, value and target.

Its value SHALL change only when a member edits the KPI: advertising imports and the
selected period SHALL NOT change it. Progress SHALL be the value over the target, higher
being better: met when equal, exceeded when above. It SHALL be compared as it is, whatever
the period.

The project's KPI dialog SHALL offer Вручную beside the metrics. Choosing it SHALL show the
fields Название, Значение and Цель, and say that they change only by hand and do not depend
on the period. Editing a KPI set by hand SHALL open with Вручную chosen and its fields
filled. The dialogs of the organization and of campaigns SHALL NOT offer it.

The KPI tile SHALL show a KPI set by hand under its name, with the value, the target, the
percentage, the progress indicator and the status as for any KPI. The project's marker in
the project list SHALL follow its progress. A project KPI set by hand SHALL NOT stand in for
a campaign without its own KPI: such a campaign's indicator SHALL be grey, as when neither
has a KPI.

#### Scenario: Setting a KPI by hand

- **WHEN** a manager opens a project's KPI dialog, chooses Вручную and saves the name
  Продажи, the value 30 and the target 50
- **THEN** the project's tile reads KPI · Продажи, shows 30 against a target of 50 and 60%,
  and its marker in the project list is red

#### Scenario: Met by hand

- **WHEN** a project's KPI set by hand has the value 50 and the target 50
- **THEN** the tile shows 100% and Выполнено, and the marker is green

#### Scenario: The period does not matter

- **WHEN** a member switches the period of a project whose KPI was set by hand
- **THEN** the tile shows the same value, target and percentage

#### Scenario: Replacing a metric KPI

- **WHEN** a project holds a KPI of 60 leads and a manager sets a KPI by hand
- **THEN** the project holds only the KPI set by hand

#### Scenario: Missing fields

- **WHEN** a request sets a KPI by hand with an empty name, a negative value or a target
  that is not a positive number
- **THEN** the API responds 400 and the KPI is unchanged

#### Scenario: Not for a campaign

- **WHEN** a manager tries to set a KPI by hand on a campaign or on the organization
- **THEN** the API responds 400, and their KPI dialogs do not offer Вручную

#### Scenario: Campaigns keep their own

- **WHEN** a running campaign has no KPI and its project's KPI was set by hand
- **THEN** the campaign's indicator is grey

#### Scenario: Editing it

- **WHEN** a manager opens the dialog of a project whose KPI was set by hand
- **THEN** Вручную is chosen and Название, Значение and Цель hold its name, value and target

### Requirement: The dashboard gauge separates the zones

The dashboard's monthly KPI gauge SHALL count every project in one of four groups by its
progress for the month so far: meets the plan at 90% or more, a little behind from 70% up to
90%, far behind below 70%, and unrated when it has no KPI or its figure is not measured. The
groups SHALL be drawn in that order along the arc in green, yellow, red and grey, and each SHALL
be listed with its count.

#### Scenario: A project a little behind
- **WHEN** a project has 24 leads against a month-to-date KPI of 30
- **THEN** it is counted as a little behind and drawn yellow

#### Scenario: A project far behind
- **WHEN** a project has 20 leads against a month-to-date KPI of 30
- **THEN** it is counted as far behind and drawn red

#### Scenario: Unrated projects
- **WHEN** a project has no KPI
- **THEN** it is counted as unrated

### Requirement: The dashboard project table shows KPI progress

Each project row in the dashboard's project table SHALL carry a mark beside its name coloured
by the project's progress against its KPI for the selected period, in the zones of the project
list, and exposed to assistive technology in words. The table SHALL offer a Выполнение KPI
column with that progress in percent, visible until a member hides it, and a dash for a
project with no KPI or no measured figure. The column SHALL be sortable like the others, with
projects without a value always last.

#### Scenario: A project on plan
- **WHEN** a project's progress is 95%
- **THEN** its row carries a green mark and its Выполнение KPI cell shows 95%

#### Scenario: A project a little behind
- **WHEN** a project's progress is 80%
- **THEN** its row carries a yellow mark

#### Scenario: A project without a KPI
- **WHEN** a project has no KPI
- **THEN** its row carries a grey mark and its Выполнение KPI cell shows a dash

#### Scenario: Sorting by progress
- **WHEN** a member chooses the Выполнение KPI header
- **THEN** the projects are ordered from the highest progress to the lowest, projects
  without a value last, and choosing it again reverses the order

### Requirement: The dashboard project table charts KPI progress

Beside each project's name the dashboard's project table SHALL draw a mini chart of the
project's KPI progress over the selected period. Each point SHALL be the progress reached on
a day with figures, counting the figures from the start of the period up to that day against
the target for the same days, so the last point equals the progress in the Выполнение KPI
column. A project with no KPI, a KPI set by hand, or no measured progress SHALL show no
chart. The chart SHALL be named for assistive technology.

#### Scenario: A project approaching its plan
- **WHEN** a project's KPI is 62 leads for the month, and by the 15th it has gained 30
- **THEN** its chart rises to the progress shown in the Выполнение KPI column

#### Scenario: A project without a KPI
- **WHEN** a project has no KPI
- **THEN** its row shows no chart

#### Scenario: A KPI set by hand
- **WHEN** a project's KPI was entered by hand
- **THEN** its row shows no chart

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

### Requirement: A project can be left out of KPI tracking

A project SHALL carry a flag telling whether its KPIs are tracked, set unless turned off, shown
as a switch labelled Отслеживать KPI in the project's header. Only members who may change both
the project and its KPIs SHALL be able to change it; the API SHALL refuse anyone else with 403
and leave the flag unchanged. A project that is not tracked SHALL keep its KPIs, which its own
page SHALL still show and let members who may change them edit. Elsewhere it SHALL be treated as
a project with no KPI that nobody is meant to set: the dashboard's gauge SHALL NOT count it, the
Важная информация panel SHALL NOT list it as a project without a KPI, its row in the dashboard's
project table SHALL show no progress and a grey mark, its marker in the project list SHALL be
grey, and no KPI-met notification SHALL be sent for it.

#### Scenario: Leaving a project out
- **WHEN** a manager turns the switch off in the header of a project that holds a KPI
- **THEN** the project stays out of the dashboard's gauge and the notices, and its KPIs are still on its page

#### Scenario: A project not counted by the gauge
- **WHEN** the dashboard holds six projects and one is not tracked
- **THEN** the gauge counts five

#### Scenario: Not warned about
- **WHEN** a project without any KPI is not tracked
- **THEN** the Важная информация panel does not list it

#### Scenario: Turning it back on
- **WHEN** the manager turns the switch on again
- **THEN** the project's KPIs count as they did before

#### Scenario: Someone who may not change KPIs
- **WHEN** a member who may update the project but not change its KPIs sends a change of the flag
- **THEN** the API responds 403 and the flag is unchanged

#### Scenario: A reader
- **WHEN** a guest opens a project
- **THEN** the header shows whether it is tracked, without a control to change it

#### Scenario: No notification
- **WHEN** every KPI of an untracked project is met
- **THEN** no KPI-met notification is sent

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

### Requirement: The KPI dialogs list their metrics in order

The metric list of a KPI dialog SHALL give every entry a label no other entry carries and SHALL
list the entries in alphabetical order of their labels, Russian labels before Latin ones. In the
project's dialog «Вручную» SHALL come last.

#### Scenario: Leads of two kinds
- **WHEN** a project has a campaign that optimises for leads and a manager opens its KPI dialog
- **THEN** the list offers «Лиды» and «Результаты - Лиды» as two entries

#### Scenario: The order
- **WHEN** a manager opens the metric list of a project's KPI dialog
- **THEN** «Выручка» comes before «Расход», «Расход» before «CPC», and «Вручную» is the last entry
