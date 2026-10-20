## ADDED Requirements

### Requirement: Images are attached from a file picker

The attachments of a task being created or edited SHALL offer a paperclip button that opens a
file picker for PNG, JPEG, WebP and GIF images, more than one at a time. Each chosen image
SHALL be uploaded under the same limits as a pasted one and added to the end of the
description, and SHALL then be listed among the attachments. A file refused by the limits
SHALL be reported beside the attachments and SHALL NOT be uploaded.

#### Scenario: Attaching a screenshot from disk

- **WHEN** a member clicks the paperclip and chooses a PNG image
- **THEN** the image is uploaded, appears at the end of the description, and is listed among
  the attachments

#### Scenario: A file that is not an image

- **WHEN** a member chooses a PDF through the paperclip
- **THEN** nothing is uploaded and the member is told that only PNG, JPEG, WebP and GIF can be
  uploaded
