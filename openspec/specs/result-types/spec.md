# result-types Specification

## Purpose
TBD - created by archiving change result-types. Update Purpose after archive.

## Requirements

### Requirement: An ad set records what it optimises for

Importing a Meta account SHALL record, for each ad set, its optimization goal, and SHALL refresh
it on every import. The goal SHALL be reported as a result type: messages for a conversations
goal, visits to the profile for a profile-visit goal, leads, link clicks, landing page views,
conversions, engagement, reach, video views, app installs, or other, and unknown when no goal is
recorded.

#### Scenario: A messages ad set
- **WHEN** an imported ad set optimises for conversations
- **THEN** it is reported with the result type messages

#### Scenario: A goal changes
- **WHEN** the ad set's goal changes at the source and the project is imported again
- **THEN** the ad set is reported with the new type

#### Scenario: Not imported since
- **WHEN** an ad set was imported before goals were recorded
- **THEN** it is reported with the result type unknown

### Requirement: Campaigns, ad sets and ads report their result type

An ad set SHALL report its result type, and an ad SHALL report the type of its ad set. A campaign
SHALL report, for the requested period, the results of each type its ad sets produced, largest
first, and a campaign with one type SHALL report just that one. A Google campaign SHALL report its
results as conversions.

#### Scenario: A campaign of two kinds
- **WHEN** a campaign has one ad set optimising for messages with 120 results and another for
  profile visits with 45 in the period
- **THEN** the campaign reports messages 120 and profile visits 45

#### Scenario: An ad
- **WHEN** an ad belongs to an ad set optimising for leads
- **THEN** the ad reports the result type leads

### Requirement: The tables show the result type

The performance tables SHALL offer a «Тип результата» column on campaign, ad set and ad rows,
shown by default and hideable like any column. A campaign with more than one type SHALL list
them in the column.

#### Scenario: The column
- **WHEN** a member opens a project's campaigns
- **THEN** each campaign row shows the type of its results

### Requirement: Results of different types are listed apart

Where a row or the «Итого» row would add results of more than one type, the «Результаты» cell
SHALL list each type with its count, such as «120 сообщений · 45 переходов в профиль», and the
«Цена результата» cell SHALL be blank. Where all results are of one type, the cell SHALL show the
number and the cost per result as before.

#### Scenario: Mixed totals
- **WHEN** a project's campaigns include messages and profile visits
- **THEN** the «Итого» row lists the two counts apart and shows no cost per result

#### Scenario: One type
- **WHEN** every campaign collects messages
- **THEN** the «Итого» row shows one number and its cost per result
