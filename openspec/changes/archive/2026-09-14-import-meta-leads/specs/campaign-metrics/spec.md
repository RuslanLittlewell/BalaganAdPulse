## ADDED Requirements

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
