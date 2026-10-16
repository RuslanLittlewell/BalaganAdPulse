## MODIFIED Requirements

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

## ADDED Requirements

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
