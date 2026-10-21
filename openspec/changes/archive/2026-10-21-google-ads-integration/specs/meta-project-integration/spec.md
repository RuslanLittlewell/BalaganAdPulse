## MODIFIED Requirements

### Requirement: Adding an integration offers the providers

Next to a project's integration panels, a member who may manage integrations SHALL find an
add control drawn with a dashed border. Choosing it SHALL open a window listing Meta,
Google, Yandex, TikTok and GPT. Meta and Google SHALL be selectable; the others SHALL be shown as
not yet available. Choosing Meta SHALL open the Meta connection form for a new connection;
choosing Google SHALL start connecting a Google Ads account.
A member who may not manage integrations SHALL see no add control.

#### Scenario: Choosing a provider
- **WHEN** an authorized member activates the add control
- **THEN** a window lists Meta, Google, Yandex, TikTok and GPT, and Meta and Google can be chosen

#### Scenario: Connecting Meta from the window
- **WHEN** the member chooses Meta
- **THEN** an empty Meta connection form opens, and submitting it adds a new connection beside the existing ones

#### Scenario: Connecting Google from the window
- **WHEN** the member chooses Google
- **THEN** Google sign-in starts for a new connection on this project

#### Scenario: No add control without the permission
- **WHEN** a member without the integration permission opens a project
- **THEN** no add control is shown
