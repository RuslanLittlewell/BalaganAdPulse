## MODIFIED Requirements

### Requirement: Creative files are fetched when first looked at, then kept

An ad's creatives SHALL be read from the provider the first time someone opens that ad's preview, not while the daily import runs, so that importing figures stays fast and storage holds only what someone has looked at. Each file SHALL be copied in the best quality the provider offers: an image's original upload rather than a scaled thumbnail, and a video's largest preview frame as its poster. Each file SHALL then be copied into the system's own storage, and every later view SHALL be served from that copy without asking the provider again, except that creatives copied under an earlier, lower-quality rule SHALL be read from the provider once more on their next view and replaced when the provider answers. A creative already stored SHALL keep working after the access token expires, the ad is paused, or the ad is removed at the provider. A video too large for the system's limit SHALL keep its poster frame and be shown through the provider's own rendering instead.

#### Scenario: First look

- **WHEN** a member opens the preview of an ad whose creatives are not stored yet
- **THEN** the creatives are read from the provider, their files are copied into storage, and they are shown

#### Scenario: Later looks

- **WHEN** the same ad's preview is opened again
- **THEN** the stored creatives are shown without any request to the provider

#### Scenario: Best quality

- **WHEN** an ad runs an image uploaded at 1080 px and a video whose provider offers preview frames of 130 px and 1080 px
- **THEN** the stored image is the 1080 px original and the video's poster is the 1080 px frame

#### Scenario: A creative stored under the earlier rule

- **WHEN** an ad whose creatives were copied before the best-quality rule is opened and its connection works
- **THEN** its creatives are read again, replaced with the better copies, and not read again on later views

#### Scenario: The earlier copy when the provider cannot answer

- **WHEN** such an ad is opened after its connection is gone
- **THEN** the earlier copies are shown and no error is reported

#### Scenario: A stored creative outlives the connection

- **WHEN** a project's Meta connection is removed or its token stops working
- **THEN** creatives stored earlier still show their pictures

#### Scenario: An ad nobody has opened, without a connection

- **WHEN** an ad whose creatives were never fetched is opened after the connection is gone
- **THEN** the dialog says in Russian that there is nothing to show, and no error is reported

#### Scenario: An oversized video

- **WHEN** a video creative exceeds the copying limit
- **THEN** its poster frame is stored and the ad is shown through the provider's own rendering
