## MODIFIED Requirements

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
