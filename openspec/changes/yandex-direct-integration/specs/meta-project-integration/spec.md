## MODIFIED Requirements

### Requirement: Adding an integration offers the providers

Next to a project's integration panels, a member who may manage integrations SHALL find an
add control drawn with a dashed border. Choosing it SHALL open a window listing Meta,
Google, Yandex, TikTok and GPT. Meta, Google and Yandex SHALL be selectable; the others SHALL be
shown as not yet available. Choosing Meta SHALL open the Meta connection form for a new
connection; choosing Google SHALL start connecting a Google Ads account; choosing Yandex SHALL
start connecting a Yandex Direct account.
A member who may not manage integrations SHALL see no add control.

#### Scenario: Choosing a provider
- **WHEN** an authorized member activates the add control
- **THEN** a window lists Meta, Google, Yandex, TikTok and GPT, and Meta, Google and Yandex can be chosen

#### Scenario: Connecting Meta from the window
- **WHEN** the member chooses Meta
- **THEN** an empty Meta connection form opens, and submitting it adds a new connection beside the existing ones

#### Scenario: Connecting Google from the window
- **WHEN** the member chooses Google
- **THEN** Google sign-in starts for a new connection on this project

#### Scenario: Connecting Yandex from the window
- **WHEN** the member chooses Yandex
- **THEN** Yandex sign-in starts for a new connection on this project

#### Scenario: No add control without the permission
- **WHEN** a member without the integration permission opens a project
- **THEN** no add control is shown

### Requirement: Connection panels are titled by logo and product
Each connection's panel SHALL be titled by its provider's logo followed by the advertising
product's name: the Meta logo and Facebook Ads for a Meta connection, the Google Ads logo and
Google Ads for a Google connection, the Я mark and Яндекс Директ for a Yandex connection. The
logo SHALL be hidden from assistive technology, so the panel and its heading are named by the
product alone.

#### Scenario: A Meta connection
- **WHEN** a member who manages integrations opens a project with a Meta connection
- **THEN** its panel is titled by the Meta logo and Facebook Ads, and is named Facebook Ads

#### Scenario: A Google connection
- **WHEN** the project also has a Google connection
- **THEN** that panel is titled by the Google Ads logo and Google Ads

#### Scenario: A Yandex connection
- **WHEN** the project also has a Yandex connection
- **THEN** that panel is titled by the Я mark and Яндекс Директ, and is named Яндекс Директ
