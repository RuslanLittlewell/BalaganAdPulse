## MODIFIED Requirements

### Requirement: Campaigns, ad sets and ads report their result type

An ad set SHALL report its result type, and an ad SHALL report the type of its ad set. A campaign
SHALL report the types its ad sets optimise for, whatever the period, and a Google campaign SHALL
report conversions. The figures of a campaign, an ad set, an ad, a project summary, a dashboard
project and each of its days SHALL include, for the requested period, the results and the spend
of each result type, largest first. Results of a campaign with no ad sets other than a Google
campaign SHALL be reported as unknown.

#### Scenario: A campaign of two kinds
- **WHEN** a campaign has one ad set optimising for messages with 120 results and 3000 spent and
  another for profile visits with 45 results and 900 spent in the period
- **THEN** its figures report messages 120 for 3000 and profile visits 45 for 900, and it reports
  the types messages and profile visits

#### Scenario: A quiet period
- **WHEN** a campaign's ad sets optimise for messages but produced nothing in the period
- **THEN** it still reports the type messages, and its figures report no results by type

#### Scenario: An ad
- **WHEN** an ad belongs to an ad set optimising for leads
- **THEN** the ad reports the result type leads

#### Scenario: A project summary
- **WHEN** the summary of a project with messages and profile-visit campaigns is read
- **THEN** it reports the results and spend of each type for the period, and so does each day of
  the dashboard project

## ADDED Requirements

### Requirement: A column pair per result type

The campaign and ad set tables SHALL offer, for each result type of the project's campaigns on the
project page and of the campaign on the campaign page, a column with the results of that type and
a column with their cost, shown by default. A row SHALL show the figures of that type, or a dash
when it has none of that type; the «Итого» row SHALL show the sum of the type and its cost over
the summed spend. Unknown SHALL get columns only when the campaigns have ad sets with no type.

#### Scenario: Two types
- **WHEN** a project's campaigns optimise for messages and for profile visits
- **THEN** the campaign table shows «Сообщения», «Цена · Сообщения», «Переходы в профиль» and
  «Цена · Переходы в профиль», each campaign filled in its own type and dashed in the other

#### Scenario: A member who chose columns before
- **WHEN** a member who has hidden some columns opens a table that now offers type columns
- **THEN** the type columns are shown and the columns the member hid stay hidden

### Requirement: A KPI on one result type

A project KPI on results or on cost per result SHALL be able to name a result type other than
unknown. The KPI dialog SHALL offer, for each type of the project's campaigns, the results of that
type and their cost, labelled by the type, and SHALL keep offering the type of a saved KPI. The
KPI's actual value SHALL be the results of that type in the period, or the type's spend over its
results; results SHALL be prorated over the month like other results, and a lower cost SHALL be
better. A type named on a KPI on any other metric SHALL be refused. The project's KPI standing,
the dashboard, the project list tone and the KPI-met notification SHALL use the same value.

#### Scenario: A messages target
- **WHEN** a project sets a monthly KPI of 300 messages and its campaigns produced 150 messages
  and 400 profile visits by the middle of the month
- **THEN** the KPI counts only the 150 messages against the prorated target

#### Scenario: A cost target
- **WHEN** a project sets a KPI of 20 per message and its messages cost 3000 for 120 messages
- **THEN** the KPI's actual value is 25 and the KPI is behind

#### Scenario: A type on the wrong metric
- **WHEN** a request names a result type on a KPI on spend
- **THEN** it is refused
