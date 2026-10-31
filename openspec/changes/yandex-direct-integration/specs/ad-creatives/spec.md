## ADDED Requirements

### Requirement: An ad imported from Yandex Direct carries its Yandex creative

An ad imported from Yandex Direct SHALL be given the creative Direct describes for it, read from
Direct the first time someone opens the ad's preview and stored like a Meta creative. A text ad
or a mobile app ad SHALL give its image when it has one, its video when it has one, and one text
creative with its headlines and its text. A responsive ad SHALL give its images in their order,
its videos, and one text creative with its headlines and texts. An image ad SHALL give its image.
A dynamic ad SHALL give its image when it has one and a text creative with its text. An ad made
in Direct's ad builder SHALL give its thumbnail as an image, or for a video ad its thumbnail as a
video's poster with a link to watch it. An ad carrying both media and text SHALL give both, with
the text last. An ad whose content Direct builds from a product feed, or an ad of a kind the
system does not read, SHALL read back with no creative rather than an error.

#### Scenario: A text ad with an image
- **WHEN** a member opens the preview of a Direct text ad with an image for the first time
- **THEN** its image is read, copied into storage and shown, followed by its two headlines and its text

#### Scenario: A responsive ad
- **WHEN** a member opens the preview of a responsive ad with three images, five headlines and two texts
- **THEN** the three images are shown in order, followed by the five headlines under Заголовки and the two texts under Описания

#### Scenario: A video from the ad builder
- **WHEN** a member opens the preview of a Direct video ad made in the ad builder
- **THEN** its thumbnail is shown with a link to watch the video, and no video file is stored

#### Scenario: A feed-built ad
- **WHEN** a member opens the preview of a shopping ad built from a product feed
- **THEN** the dialog says in Russian that there is nothing to show

## MODIFIED Requirements

### Requirement: A text creative holds an ad's words

A creative MAY be of the kind text, with no file. It SHALL keep the ad's headlines in its title and
its descriptions in its body, one per line, in the order the provider gives them, and SHALL be
shown as two lists headed Заголовки and Описания. A Yandex ad's texts SHALL be kept as its
descriptions.

#### Scenario: Headlines and descriptions
- **WHEN** a responsive search ad has fifteen headlines and four descriptions
- **THEN** its text creative lists the fifteen headlines under Заголовки and the four descriptions under Описания

#### Scenario: A Yandex text ad
- **WHEN** a Direct text ad has a headline, a second headline and a text
- **THEN** its text creative lists the two headlines under Заголовки and the text under Описания

### Requirement: A video creative may link to where it can be watched

A creative MAY carry the address of the page where its video is watched. For a Google ad's YouTube
video it SHALL be the video's YouTube address, and for a Yandex ad's video it SHALL be Direct's
preview address of that video. Such a creative SHALL keep a stored copy of the video's thumbnail
as its poster rather than a copy of the video. The preview SHALL show the poster with a link to
watch the video, and SHALL NOT offer the rendered preview of Meta for it.

#### Scenario: A YouTube video
- **WHEN** a member opens the preview of a Google video ad
- **THEN** the video's thumbnail is shown with a link to watch it on YouTube, and no video file is stored

#### Scenario: A Yandex video
- **WHEN** a member opens the preview of a Direct text ad with a video
- **THEN** the video's thumbnail is shown with a link to watch it in Direct's preview, and no video file is stored

#### Scenario: Meta keeps its rendered preview
- **WHEN** a member opens a Meta video ad whose video is too large to copy
- **THEN** the dialog still shows Meta's rendered preview of it
