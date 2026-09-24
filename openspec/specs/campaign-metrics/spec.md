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
figures the platform measured: spend, impressions, reach, clicks, conversions
and revenue. There SHALL be at most one row per entity per date, and recording
the same date again SHALL replace it rather than add to it.

#### Scenario: Recording a day

- **WHEN** a day's figures are recorded for an entity
- **THEN** they can be read back for that date

#### Scenario: Recording the same day twice

- **WHEN** a day already recorded is recorded again with different figures
- **THEN** the entity has one row for that date, holding the later figures

### Requirement: Ratios are derived, never stored

The system SHALL NOT store CTR, CPC, CPM, CPA, ROAS or frequency. Each SHALL be
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

Every metrics view SHALL offer last-7-days, current-month and previous-month shortcuts before its date inputs. A shortcut SHALL apply its inclusive range the same way a manual entry does and SHALL report itself as pressed only while the current range equals the range it produces.

#### Scenario: Apply a shortcut

- **WHEN** a user presses the last-7-days shortcut
- **THEN** both date inputs and every metrics request use the seven days ending today
- **AND** the address carries those two dates

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
