## Purpose

An ad's creative — the images, carousel frames or video the audience actually saw — kept beside the figures it produced, so a buyer judges an ad on the campaign screen instead of leaving for Ads Manager.

## ADDED Requirements

### Requirement: An ad carries the creative it was shown with

Every imported ad SHALL carry the creative it ran with: one entry for a single image or video, and one entry per frame for a carousel, each keeping its order and its provider identifier. An ad whose creative the provider does not describe SHALL still be listed, with no creative rather than an error.

#### Scenario: A single-image ad

- **WHEN** an imported ad runs one image
- **THEN** the ad carries one creative entry marked as an image

#### Scenario: A carousel ad

- **WHEN** an imported ad runs a carousel
- **THEN** the ad carries one entry per frame, in the order the frames are shown

#### Scenario: An ad without a described creative

- **WHEN** the provider returns an ad with no creative it can describe
- **THEN** the ad is imported and reads back with an empty creative list

### Requirement: Creative files are fetched when first looked at, then kept

An ad's creatives SHALL be read from the provider the first time someone opens that ad's preview, not while the daily import runs, so that importing figures stays fast and storage holds only what someone has looked at. Each file SHALL then be copied into the system's own storage, and every later view SHALL be served from that copy without asking the provider again. A creative already stored SHALL keep working after the access token expires, the ad is paused, or the ad is removed at the provider. A video too large for the system's limit SHALL keep its poster frame and be shown through the provider's own rendering instead.

#### Scenario: First look

- **WHEN** a member opens the preview of an ad whose creatives are not stored yet
- **THEN** the creatives are read from the provider, their files are copied into storage, and they are shown

#### Scenario: Later looks

- **WHEN** the same ad's preview is opened again
- **THEN** the stored creatives are shown without any request to the provider

#### Scenario: A stored creative outlives the connection

- **WHEN** a project's Meta connection is removed or its token stops working
- **THEN** creatives stored earlier still show their pictures

#### Scenario: An ad nobody has opened, without a connection

- **WHEN** an ad whose creatives were never fetched is opened after the connection is gone
- **THEN** the dialog says in Russian that there is nothing to show, and no error is reported

#### Scenario: An oversized video

- **WHEN** a video creative exceeds the copying limit
- **THEN** its poster frame is stored and the ad is shown through the provider's own rendering

### Requirement: Creative files follow the reach of their ad

A creative file SHALL be readable only by a member who may reach the project the ad belongs to, and SHALL be served by the API rather than by a public or provider link. A request for a creative of an unreachable or unknown ad SHALL answer 404.

#### Scenario: A member without reach

- **WHEN** a member who may not reach the project requests a creative file
- **THEN** the API answers 404 without revealing whether it exists

#### Scenario: A member with reach

- **WHEN** a member who may reach the project requests a creative file
- **THEN** the file is returned with its own content type

### Requirement: Creatives are previewed from the campaign screen

The ad set table SHALL open a preview dialog when an ad row is chosen. The dialog SHALL show the chosen ad's creative, name its ad, and let the viewer move to every other ad of the same ad set without closing it. A video creative SHALL play in the dialog. The dialog SHALL be closable by keyboard and SHALL say in Russian when an ad has no creative to show.

#### Scenario: Open an ad's creative

- **WHEN** a buyer chooses an ad row in the ad set table
- **THEN** a dialog opens showing that ad's creative and its name

#### Scenario: Page through the ad set

- **WHEN** the dialog is open on one ad of an ad set
- **THEN** the buyer can move to the previous and next ads of the same ad set

#### Scenario: Play a video creative

- **WHEN** the shown creative is a stored video
- **THEN** it plays inside the dialog

#### Scenario: An ad with nothing to show

- **WHEN** the shown ad carries no creative
- **THEN** the dialog says so in Russian and still allows moving to the other ads

### Requirement: A video with no stored file is shown through the provider's own preview

A video creative the provider will not hand over as a file SHALL be shown in the dialog through the provider's own rendering of the ad, fetched on demand rather than stored. The link to that rendering SHALL be obtained by the server, using the project's stored credentials, and SHALL follow the reach of the ad it belongs to. An ad whose preview the provider will not render SHALL keep its poster and its link out to the provider.

#### Scenario: Show a video the provider keeps

- **WHEN** the dialog shows a video creative with no stored file
- **THEN** the ad is rendered as the provider shows it, and the video plays there

#### Scenario: A preview asked for an unreachable ad

- **WHEN** a member who may not reach the project asks for an ad's preview
- **THEN** the API answers 404

#### Scenario: A project with no connection

- **WHEN** an ad's project has no advertising connection
- **THEN** the API answers 404 and the dialog keeps the poster and the link out
