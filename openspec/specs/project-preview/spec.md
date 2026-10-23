# project-preview Specification

## Purpose
TBD - created by archiving change project-preview-mode. Update Purpose after archive.

## Requirements

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

### Requirement: Preview is kept in the address

Preview SHALL be named in the address as `preview=1` and SHALL apply to a project's pages only;
elsewhere the parameter SHALL be ignored. Opening such an address SHALL show the preview, opening
a campaign from it and coming back SHALL keep it, and the browser's back button SHALL leave it. A
«Выйти из превью» button SHALL be shown in preview and SHALL leave it.

#### Scenario: Leaving preview
- **WHEN** a member presses «Выйти из превью»
- **THEN** the page is shown whole again and the address no longer names preview

#### Scenario: A reload
- **WHEN** the page is reloaded in preview
- **THEN** it opens in preview

#### Scenario: Not a project page
- **WHEN** an address outside the projects names preview
- **THEN** the page is shown with its navigation as usual

### Requirement: Switching between the client's projects in preview

In preview a bar at the top SHALL show, on the left, a select naming the shown project and
listing the projects of its client that the member reaches, by name, and, on the right, the
«Выйти из превью» button. Choosing a project SHALL open it in preview with the same period. The
bar SHALL also be shown on a campaign page in preview, where choosing a project opens that
project.

#### Scenario: Another project of the client
- **WHEN** a member in preview chooses another project of the same client
- **THEN** that project opens in preview for the same period

#### Scenario: Other clients
- **WHEN** a member opens the select in preview
- **THEN** only the projects of the shown project's client are offered
