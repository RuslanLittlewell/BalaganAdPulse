## MODIFIED Requirements

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

## ADDED Requirements

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
