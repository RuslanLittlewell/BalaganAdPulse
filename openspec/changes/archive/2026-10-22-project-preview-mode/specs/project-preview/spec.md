## ADDED Requirements

### Requirement: A project can be shown in preview

The project page SHALL offer a «Превью» button beside its metrics. In preview the page SHALL show
only the metrics heading with the period controls, the summary tiles, the account tabs, the
running-only switch and the campaign table, across the whole width. The navigation, the app
header, the project list, the project header and its tabs, the integrations and the tasks SHALL be
hidden. The summary SHALL offer no tile configuration and the KPI tiles no edit control.

#### Scenario: Entering preview
- **WHEN** a member presses «Превью» on a project
- **THEN** only the metrics, the tiles and the campaign table remain, and the navigation, the
  project list, the project header and the tasks are gone

#### Scenario: Nothing to change
- **WHEN** a project is shown in preview
- **THEN** no control to add a tile or to change a KPI is shown

#### Scenario: Looking around
- **WHEN** a member changes the period or the account tab in preview
- **THEN** the figures follow and the page stays in preview

### Requirement: Preview is kept in the address

Preview SHALL be named in the address as `preview=1`. Opening such an address SHALL show the
preview, opening a campaign from it and coming back SHALL keep it, and the browser's back button
SHALL leave it. A «Выйти из превью» button SHALL be shown in preview and SHALL leave it.

#### Scenario: Leaving preview
- **WHEN** a member presses «Выйти из превью»
- **THEN** the page is shown whole again and the address no longer names preview

#### Scenario: A reload
- **WHEN** the page is reloaded in preview
- **THEN** it opens in preview
