## ADDED Requirements

### Requirement: An ad imported from Google Ads carries its Google creative

An ad imported from Google Ads SHALL be given the creative Google describes for it, read from Google
Ads the first time someone opens the ad's preview and stored like a Meta creative. An image ad
SHALL give its image. A responsive display or Demand Gen ad SHALL give its images, marketing images
before square ones, in their order, and its YouTube videos. A video ad SHALL give its YouTube
videos. A search or text ad SHALL give one text creative. An ad carrying both media and text SHALL
give both, with the text last. An ad of a kind the system does not read, or an ad of a Performance
Max campaign, SHALL read back with no creative rather than an error.

#### Scenario: An image ad
- **WHEN** a member opens the preview of a Google image ad for the first time
- **THEN** its image is read, copied into storage and shown

#### Scenario: A display ad
- **WHEN** a member opens the preview of a responsive display ad with three marketing images and one logo
- **THEN** the three marketing images are shown in order, followed by the ad's headlines and descriptions

#### Scenario: A search ad
- **WHEN** a member opens the preview of a responsive search ad
- **THEN** one text creative shows its headlines and its descriptions

#### Scenario: An unreadable kind
- **WHEN** a member opens the preview of an ad of a kind the system does not read
- **THEN** the dialog says in Russian that there is nothing to show

### Requirement: A text creative holds an ad's words

A creative MAY be of the kind text, with no file. It SHALL keep the ad's headlines in its title and
its descriptions in its body, one per line, in the order Google gives them, and SHALL be shown as
two lists headed Заголовки and Описания.

#### Scenario: Headlines and descriptions
- **WHEN** a responsive search ad has fifteen headlines and four descriptions
- **THEN** its text creative lists the fifteen headlines under Заголовки and the four descriptions under Описания

### Requirement: A video creative may link to where it can be watched

A creative MAY carry the address of the page where its video is watched. For a Google ad's YouTube
video it SHALL be the video's YouTube address, and the creative SHALL keep a stored copy of the
video's thumbnail as its poster rather than a copy of the video. The preview SHALL show the poster
with a link to watch the video on YouTube, and SHALL NOT offer the rendered preview of Meta for it.

#### Scenario: A YouTube video
- **WHEN** a member opens the preview of a Google video ad
- **THEN** the video's thumbnail is shown with a link to watch it on YouTube, and no video file is stored

#### Scenario: Meta keeps its rendered preview
- **WHEN** a member opens a Meta video ad whose video is too large to copy
- **THEN** the dialog still shows Meta's rendered preview of it
