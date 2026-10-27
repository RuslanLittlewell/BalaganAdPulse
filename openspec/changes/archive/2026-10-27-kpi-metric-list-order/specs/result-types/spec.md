## MODIFIED Requirements

### Requirement: A KPI on one result type

A project KPI or a campaign KPI on results or on cost per result SHALL be able to name a result
type other than unknown; the organization KPI SHALL NOT. The project's KPI dialog SHALL offer, for
each type of the project's campaigns, the results of that type and their cost, and the campaign's
KPI dialog SHALL offer the same for each type of the campaign; both SHALL keep offering the type of
a saved KPI. The results of a type SHALL be labelled «Результаты - <тип>» and their cost
«Цена · <тип>», in the dialogs, on the KPI tile and on the campaign KPI blocks. The KPI's actual
value SHALL be the results of that type in the period, or the type's spend over its results;
results SHALL be prorated over the month like other results, and a lower cost SHALL be better. A
type named on a KPI on any other metric SHALL be refused. The project's KPI standing, the
dashboard, the project list tone and the KPI-met notification SHALL use the same value, and so
SHALL the campaign's indicator and its progress block.

#### Scenario: A messages target
- **WHEN** a project sets a monthly KPI of 300 messages and its campaigns produced 150 messages
  and 400 profile visits by the middle of the month
- **THEN** the KPI counts only the 150 messages against the prorated target and its tile reads
  «KPI · Результаты - Сообщения»

#### Scenario: A cost target
- **WHEN** a project sets a KPI of 20 per message and its messages cost 3000 for 120 messages
- **THEN** the KPI's actual value is 25 and the KPI is behind

#### Scenario: A type on the wrong metric
- **WHEN** a request names a result type on a KPI on spend
- **THEN** it is refused

#### Scenario: A campaign's messages target
- **WHEN** a manager sets a campaign KPI of 20 per message and reads the campaign back
- **THEN** the campaign's KPI names the messages type

#### Scenario: Not on the organization
- **WHEN** a request names a result type on the organization KPI
- **THEN** it is refused and the organization KPI is unchanged
