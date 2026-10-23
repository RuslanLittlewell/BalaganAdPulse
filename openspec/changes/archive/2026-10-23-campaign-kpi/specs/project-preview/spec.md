## MODIFIED Requirements

### Requirement: A project can be shown in preview

The project header SHALL offer a preview button, drawn as a full-screen icon, named «Превью»,
placed before the KPI-tracking switch and parted from it by a divider. In preview
the page SHALL show only the metrics heading with the period controls, the summary tiles, the
account tabs, the running-only switch, the campaign KPI blocks and the campaign table, across the
whole width. The
navigation, the app header, the project list, the project header and its tabs, the integrations
and the tasks SHALL be hidden. The summary SHALL offer no tile configuration and the KPI tiles no
edit control.

#### Scenario: Entering preview
- **WHEN** a member presses «Превью» in a project's header
- **THEN** only the metrics, the tiles and the campaign table remain, and the navigation, the
  project list, the project header and the tasks are gone

#### Scenario: Nothing to change
- **WHEN** a project is shown in preview
- **THEN** no control to add a tile or to change a KPI is shown

#### Scenario: Looking around
- **WHEN** a member changes the period or the account tab in preview
- **THEN** the figures follow and the page stays in preview
