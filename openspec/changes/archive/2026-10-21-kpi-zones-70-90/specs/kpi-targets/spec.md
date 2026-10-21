## MODIFIED Requirements

### Requirement: A campaign's indicator follows its KPI

Each campaign row in a project's campaign table SHALL carry a coloured indicator decided by
the campaign's progress against its KPI for the selected period. The KPI SHALL be the
campaign's own, or the project's when the campaign has none. Progress SHALL be the
percentage achieved as the KPI tile computes it, counting lower-is-better metrics in their
favourable direction. The indicator SHALL be:

- grey when the campaign is not running (paused, rejected or ended), when neither the
  campaign nor the project has a KPI, or when the KPI's figure is not measured;
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
- **WHEN** a running campaign has no KPI and the project's KPI is met by it
- **THEN** its indicator is green

#### Scenario: Not running
- **WHEN** a campaign is paused, whatever its figures
- **THEN** its indicator is grey

#### Scenario: No KPI anywhere
- **WHEN** neither a running campaign nor its project has a KPI
- **THEN** its indicator is grey
