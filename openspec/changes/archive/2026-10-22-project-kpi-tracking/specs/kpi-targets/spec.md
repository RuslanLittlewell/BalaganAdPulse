## ADDED Requirements

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
