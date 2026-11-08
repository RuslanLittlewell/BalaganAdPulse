# campaign-metrics Specification

## Purpose
Campaign metrics are the measured performance of a client's advertising, as the
ad platforms report it: a hierarchy of campaigns, ad sets and ads, each carrying
figures per day, from which every ratio a media buyer reads is derived.

## Requirements

### Requirement: A campaign belongs to a channel

Every campaign SHALL name the advertising channel it runs on, its status on that
channel, and MAY carry its objective and the identifier the channel knows it by.
A campaign SHALL belong to exactly one project.

#### Scenario: Reading a campaign

- **WHEN** a member reads a campaign they reach
- **THEN** its channel, status, objective and platform identifier are returned

#### Scenario: An unknown channel

- **WHEN** a campaign is created naming a channel the system does not support
- **THEN** the request is refused and nothing is stored

### Requirement: A campaign contains ad sets, which contain ads

An ad set SHALL belong to exactly one campaign, and an ad to exactly one ad set.
Removing a campaign SHALL remove the ad sets and ads beneath it. Reach is
inherited: a member who cannot reach the campaign SHALL NOT reach anything
inside it, and SHALL be told it does not exist rather than that it is forbidden.

#### Scenario: Reading the hierarchy

- **WHEN** a member reads a campaign they reach
- **THEN** they can read its ad sets, and the ads within each

#### Scenario: An unreachable ad

- **WHEN** a member requests an ad under a campaign they hold no grant over
- **THEN** the answer is 404

#### Scenario: Removing a campaign

- **WHEN** a campaign is removed
- **THEN** its ad sets, its ads and every measured figure beneath it are removed

### Requirement: Figures are measured per day, per entity

The system SHALL store, for a campaign, an ad set or an ad on a given date, the
figures the platform measured: spend, impressions, reach, clicks, conversions,
results and revenue. There SHALL be at most one row per entity per date, and recording
the same date again SHALL replace it rather than add to it.

#### Scenario: Recording a day

- **WHEN** a day's figures are recorded for an entity
- **THEN** they can be read back for that date

#### Scenario: Recording the same day twice

- **WHEN** a day already recorded is recorded again with different figures
- **THEN** the entity has one row for that date, holding the later figures

### Requirement: Ratios are derived, never stored

The system SHALL NOT store CTR, CPC, CPM, CPA, cost per result, ROAS or frequency. Each SHALL be
computed from the measured figures at the moment it is read, so that a stored
total and a stored ratio can never contradict one another.

A ratio whose divisor is zero SHALL be reported as absent rather than as zero,
since no value was measured.

#### Scenario: Deriving over a range

- **WHEN** a range is summarised
- **THEN** each ratio is computed from the summed figures of that range, not by
  averaging the ratios of its days

#### Scenario: A campaign with no clicks

- **WHEN** a campaign recorded spend but no clicks
- **THEN** its cost per click is absent, not zero

#### Scenario: Cost per result
- **WHEN** a range spent 220.58 and recorded 56 results
- **THEN** its cost per result is 220.58 / 56, and it is absent when no result was recorded

### Requirement: A range is summarised by summing what it contains

Reading an entity over a date range SHALL return the sum of its measured figures
across the dates in that range, together with the ratios derived from those
sums. A range SHALL include both its endpoints, and dates with no row SHALL
contribute nothing rather than being treated as absent data.

#### Scenario: Summing a range

- **WHEN** an entity is read over a range of dates
- **THEN** the figures are the totals of the days within it, endpoints included

#### Scenario: A gap in the range

- **WHEN** a date within the range has no recorded row
- **THEN** it contributes nothing and the surrounding days are still summed

### Requirement: A parent is the sum of its children

A campaign's figures over a range SHALL be the sum of its own measured rows; a
project's SHALL be the sum of its campaigns'; and the organization's SHALL be
the sum of the projects the reading member reaches. A summary SHALL never
include a project the member cannot reach.

#### Scenario: A project's total

- **WHEN** a member reads a project over a range
- **THEN** the figures are the totals of its campaigns over that range

#### Scenario: A member with a partial grant

- **WHEN** a member holding a grant over one project reads the agency summary
- **THEN** only that project's figures are included

### Requirement: The campaign sheet is gone

The system SHALL NOT expose user-defined campaign properties, formulas, daily
rows or property values. The addresses they occupied SHALL answer as unknown
endpoints, and the permission matrix SHALL NOT name them.

#### Scenario: Calling a removed address

- **WHEN** any caller requests a property, record or value address
- **THEN** the API answers 404, whatever their role

#### Scenario: The matrix

- **WHEN** the resource list is read
- **THEN** it contains no property, record or value entry

### Requirement: A project starts empty

Creating a project SHALL create the project alone. No campaign SHALL be created
alongside it.

#### Scenario: A new project

- **WHEN** a member creates a project
- **THEN** the project exists and has no campaigns

### Requirement: Users choose an exact reporting range

Every metrics view SHALL present two date inputs for the inclusive start and end of its reporting range. Each input SHALL support direct entry and a Russian-language calendar. A valid selection SHALL update the range shared by the dashboard, project and campaign views and SHALL be represented in the address so reload and browser navigation preserve it.

#### Scenario: Select a range with calendars

- **WHEN** a user chooses a start date and an end date from the two calendars
- **THEN** every metrics request uses those dates as its inclusive `from` and `to` range

#### Scenario: Enter a range manually

- **WHEN** a user types two valid dates with the start no later than the end
- **THEN** the same range is applied and preserved in the address

#### Scenario: Reject an invalid range

- **WHEN** an entered date is invalid or the start is later than the end
- **THEN** the interface explains the problem in Russian
- **AND** metrics requests continue using the last valid range

#### Scenario: Restore a shared link

- **WHEN** a user opens an address containing a valid start and end date
- **THEN** both date inputs and every metrics view use that range

#### Scenario: Invalid dates in an address

- **WHEN** an address contains missing, malformed or reversed range dates
- **THEN** the interface falls back to the default last-30-days range

### Requirement: Users fill the range from shortcuts

Every metrics view SHALL offer yesterday, last-7-days, current-month and previous-month shortcuts, in that order, before its date inputs. The yesterday shortcut SHALL produce a range that starts and ends on the day before today. A shortcut SHALL apply its inclusive range the same way a manual entry does and SHALL report itself as pressed only while the current range equals the range it produces.

#### Scenario: Apply a shortcut

- **WHEN** a user presses the last-7-days shortcut
- **THEN** both date inputs and every metrics request use the seven days ending today
- **AND** the address carries those two dates

#### Scenario: Yesterday

- **WHEN** a user presses Вчера on 13 October
- **THEN** both date inputs read 12 October and every metrics request covers that day alone

#### Scenario: Shortcut reflects the current range

- **WHEN** the current range equals the range a shortcut produces
- **THEN** that shortcut is presented as pressed and the others are not

### Requirement: The conversions figure is presented as leads
Wherever figures are shown to members — performance tables and their column chooser, summaries and daily charts — the conversions figure SHALL be labelled Лиды and the cost per conversion ratio SHALL be labelled CPL. The figure, its measurement, its derivation and the names used in API responses SHALL remain unchanged, and a member's saved choice of visible columns SHALL keep applying to both.

#### Scenario: Table header
- **WHEN** a member opens a performance table
- **THEN** the lead count column reads Лиды and the cost per lead column reads CPL

#### Scenario: Column chooser
- **WHEN** a member opens the table's column chooser
- **THEN** the choices include Лиды and CPL and no Конверсии or CPA

#### Scenario: Previously hidden column
- **WHEN** a member had hidden the conversions column before the rename
- **THEN** the Лиды column stays hidden

#### Scenario: Summary and chart
- **WHEN** a member reads the performance summary or a campaign's daily chart
- **THEN** the lead figure is labelled Лиды and its cost is labelled CPL

### Requirement: A project's own campaigns can be listed as references

The system SHALL offer a listing of a project's campaigns carrying only what identifies
one — its id, its name and its channel — with no date range and no measured figures.
The listing SHALL follow the same reach rules as every other campaign reading: a member
who cannot reach the project SHALL be told it does not exist.

This exists so that choosing a campaign is not a metrics reading. Asking for every
campaign's figures to render a picker would compute sums nobody reads, and would make
the list depend on a period the chooser never named.

#### Scenario: Listing a project's campaigns for a picker

- **WHEN** a member asks for the campaigns of a project they can reach, naming no range
- **THEN** every campaign of that project is returned with its id, name and channel, and
  no figures

#### Scenario: A project the member cannot reach

- **WHEN** a member asks for the campaigns of a project they hold no grant for
- **THEN** the API responds 404

### Requirement: The projects summary carries each project's KPI

Each entry of the reading that returns every reachable project's figures in one request
SHALL also carry that project's own KPI: its metric and its target with four decimal
places, and for a KPI set by hand also its name and its value with four decimal places,
or null when the project has none. A campaign's KPI SHALL NOT stand in for the project's.
The KPI SHALL be returned whatever the range, so a client can compare it with the figures
beside it. Each KPI SHALL carry the account it names, or null. For each account named by one of
the project's KPIs, the entry SHALL also carry that account's figures for the range and its daily
figures, summed over the project's campaigns imported from it, and zero when there are none.

#### Scenario: A project with a KPI

- **WHEN** a member reads the projects summary and a reachable project holds a KPI of 60 leads
- **THEN** that project's entry carries the metric and the target 60.0000

#### Scenario: A project without a KPI

- **WHEN** a reachable project holds no KPI while one of its campaigns does
- **THEN** that project's entry carries a null KPI

#### Scenario: A project with a KPI set by hand

- **WHEN** a reachable project holds a KPI set by hand named Продажи with the value 30 and
  the target 50
- **THEN** that project's entry carries the metric MANUAL, the name Продажи, the value
  30.0000 and the target 50.0000

#### Scenario: A KPI naming an account

- **WHEN** a reachable project's campaigns come from two accounts and one of its KPIs names the second
- **THEN** that project's entry carries the second account's figures and daily figures, and none for the first

### Requirement: A campaign's ad set table shows running ad sets first or alone

The campaign page SHALL offer a «Только активные» switch above its ad set table, which SHALL be on
whenever a campaign is opened and SHALL NOT be remembered between campaigns or visits. An ad set or
an ad SHALL count as running when it is active or learning.

While the switch is on, the table SHALL list only running ad sets and, under an expanded ad set,
only its running ads. While it is off, the table SHALL list every ad set and ad, running ones above
the rest. In either case they SHALL keep their existing order among themselves. A campaign with ad
sets of which none is running SHALL, with the switch on, say that no ad set is running rather than
that the campaign has none.

#### Scenario: Opening a campaign
- **WHEN** a member opens a campaign whose ad sets are partly paused
- **THEN** the switch is on and only the running ad sets are listed

#### Scenario: Running ads only
- **WHEN** the member expands a running ad set holding a running and a paused ad
- **THEN** only the running ad is listed under it

#### Scenario: Turning the switch off
- **WHEN** the member turns the switch off
- **THEN** every ad set and ad is listed, running ones first

#### Scenario: Nothing running
- **WHEN** every ad set of a campaign is paused and the switch is on
- **THEN** the table says no ad set is running

#### Scenario: Another campaign
- **WHEN** a member who turned the switch off opens another campaign
- **THEN** the switch is on again

### Requirement: A project's figures are titled
A project page SHALL open the figures of the period — the summary and the campaign table —
with a second-level heading, Метрики, on the same row as the period control, styled like the
other section titles of the page. Every member who opens the project SHALL see it.

#### Scenario: Opening a project
- **WHEN** a guest opens a project page
- **THEN** the heading Метрики is shown beside the period control, above the summary

### Requirement: Every reachable project's figures are read in one request

The system SHALL offer a reading, over a date range, of every project the member
reaches, returning in one response one entry per project: the project's id, its figures
over the range summed from its campaigns, and its daily series over the range, one entry
per measured day, oldest first. A project with no campaigns, or none measured in the
range, SHALL be listed with zero figures and an empty series. A project the member
cannot reach SHALL never be listed.

The reading SHALL follow the same rules as the agency summary: the member's role must
allow reading campaigns, and a range that ends before it starts SHALL be refused with a
400.

The dashboard's project table SHALL draw every project's row from this one reading, so
the number of requests it makes does not grow with the number of projects.

#### Scenario: Reading every project at once

- **WHEN** a member reads the projects summary over a range
- **THEN** one response holds each project they reach with its totals and its daily
  series over that range

#### Scenario: A project with nothing measured

- **WHEN** a reachable project has no campaigns, or none measured in the range
- **THEN** it is listed with zero spend and an empty daily series

#### Scenario: A member with a partial grant

- **WHEN** a member holding a grant over one project reads the projects summary
- **THEN** only that project is listed

#### Scenario: A range that ends before it starts

- **WHEN** the projects summary is asked for with a range whose end precedes its start
- **THEN** the API responds 400

#### Scenario: The dashboard with many projects

- **WHEN** the dashboard opens for a member who reaches many projects
- **THEN** the project table's figures and sparklines come from a single projects
  summary request, not from a request per project

### Requirement: A project's campaign table shows running campaigns first or alone

A project's campaign table SHALL offer a «Только активные» switch, which SHALL be on
whenever a project is opened and SHALL NOT be remembered between projects or visits.
A campaign SHALL count as running when it is active or learning, as its indicator
counts it.

While the switch is on, the table SHALL list only running campaigns. While it is off, the
table SHALL list every campaign, running ones above the rest. In either case campaigns
SHALL keep their existing order among themselves. The switch SHALL narrow the campaigns
of the chosen advertising account when they are split by account.

The table's total row SHALL total the campaigns the table lists: their measured figures
summed, and every ratio derived from those sums as a project's total derives it. A
project with campaigns of which none is running SHALL, with the switch on, say that no
campaign is running rather than that the project has none.

#### Scenario: Opening a project

- **WHEN** a member opens a project whose campaigns are partly running
- **THEN** the switch is on and the table lists only the running campaigns, in their
  existing order, with a total row of those campaigns

#### Scenario: Turning the switch off

- **WHEN** a member turns the switch off
- **THEN** every campaign is listed, running ones first, and the total row totals them all

#### Scenario: Opening another project

- **WHEN** a member who turned the switch off opens another project
- **THEN** the switch is on again

#### Scenario: A learning campaign

- **WHEN** a campaign is learning
- **THEN** it is listed with the switch on

#### Scenario: Nothing running

- **WHEN** a project's campaigns are all paused or ended and the switch is on
- **THEN** the table says no campaign is running

#### Scenario: A total of the listed campaigns

- **WHEN** the table lists campaigns that spent 200 and 800 with revenue of 1000 each
- **THEN** the total row shows a spend of 1000 and a ROAS of 2, not the average of the
  campaigns' ROAS

### Requirement: The results figure is shown with its cost
Wherever figures are shown to members — performance tables and their column chooser and
the period summary — the results figure SHALL be labelled Результаты and the cost per result
SHALL be labelled Цена результата, formatted as a count and as an amount in the project's
currency, as Лиды and CPL are. Both SHALL be offered as columns of every performance table;
a member who saved a choice of visible columns before they existed SHALL find them hidden
until they turn them on, as with any column added later.

#### Scenario: Table header
- **WHEN** a member who never chose columns opens a project's campaign table
- **THEN** it shows the columns Результаты and Цена результата

#### Scenario: A saved choice of columns
- **WHEN** a member had chosen their visible columns before Результаты existed
- **THEN** Результаты is offered in the column chooser and is not shown until they turn it on

#### Scenario: Results beside leads
- **WHEN** a campaign recorded 56 results and 2 leads in the period
- **THEN** its row shows 56 under Результаты and 2 under Лиды
