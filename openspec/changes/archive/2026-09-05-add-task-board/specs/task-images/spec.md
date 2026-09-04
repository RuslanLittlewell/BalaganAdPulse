## Purpose

A task description is often a screenshot with a sentence around it. This capability covers
getting that image out of the clipboard and into the description — uploading it, storing it
outside the description, and serving it back to the people who can read the task.

## ADDED Requirements

### Requirement: Images are added by pasting or dropping

The description editor SHALL accept an image pasted with Ctrl+V and an image file dropped
onto it, and SHALL upload it without the member choosing a file from a dialog. A file picker
SHALL remain available as well, so the feature is reachable without a clipboard.

#### Scenario: Pasting a screenshot
- **WHEN** a member copies a screenshot to the clipboard and presses Ctrl+V in the
  description
- **THEN** the image is uploaded and appears inline in the description at the cursor

#### Scenario: Dropping an image file
- **WHEN** a member drags an image file from the desktop onto the description
- **THEN** the image is uploaded and appears inline at the point it was dropped

#### Scenario: Dropping onto the board rather than the editor
- **WHEN** a member drops an image file anywhere outside the description editor
- **THEN** nothing is uploaded and the browser does not navigate away from the board

#### Scenario: Pasted text is still text
- **WHEN** a member pastes text rather than an image
- **THEN** the text is inserted as text and no upload is attempted

### Requirement: Uploads are limited by type and size

An upload SHALL be accepted only for PNG, JPEG, WebP and GIF, and only up to 10 MB. The type
SHALL be determined from the file's own content rather than from its name or the declared
content type. A refused upload SHALL leave the description as it was.

#### Scenario: An accepted screenshot
- **WHEN** a 2 MB PNG is pasted
- **THEN** it is stored and referenced from the description

#### Scenario: A file that is too large
- **WHEN** a 25 MB image is dropped
- **THEN** the API responds 400, the member is told the file is too large, and no reference
  is inserted

#### Scenario: A file that is not an image
- **WHEN** a PDF renamed to `.png` is dropped
- **THEN** the API responds 400 and nothing is stored

### Requirement: Image bytes live in object storage, not in the description

An uploaded image SHALL be stored as an object in the configured storage service, and the
description SHALL carry only a reference to it. A description SHALL NOT carry image bytes
inline.

#### Scenario: The saved description carries a reference
- **WHEN** a task with a pasted image is saved and read back
- **THEN** the description names the image by its identifier, and the bytes are not part of
  the description

#### Scenario: Storage is unavailable
- **WHEN** the storage service refuses an upload
- **THEN** the member is told the image could not be uploaded, and the description keeps the
  text already typed

### Requirement: An image is served only to members who can read its task

Fetching an image SHALL require the same authentication as every other `/api` endpoint, and
SHALL be permitted only to a member who can reach the task the image belongs to. An image
whose task is unreachable SHALL answer 404.

#### Scenario: Opening the image address without credentials
- **WHEN** the address of a task image is opened in a browser tab carrying no access token
- **THEN** the request is refused and the bytes are not served

#### Scenario: A member without a grant
- **WHEN** a manager requests an image belonging to a task in a project they hold no grant
  for
- **THEN** the API responds 404

#### Scenario: Reading a task with images
- **WHEN** a member who can reach a task opens it
- **THEN** every image in its description is displayed

### Requirement: An image not yet attached belongs to its uploader

Between upload and the save of the description that references it, an image SHALL be
reachable only by the member who uploaded it.

#### Scenario: Another member guesses the identifier
- **WHEN** a member requests an uploaded image that no saved task references and that they
  did not upload
- **THEN** the API responds 404

#### Scenario: The uploader still sees it while editing
- **WHEN** the member who pasted an image is still filling in the dialog
- **THEN** the image is displayed in the editor before the task has been saved

### Requirement: Abandoned uploads are reclaimable

Each uploaded image SHALL be recorded with the task it belongs to, once known, and with the
time it was uploaded, so that an image whose task was never saved can be found and removed
later. Deleting a task SHALL remove the images its description referenced.

#### Scenario: The dialog is cancelled after pasting
- **WHEN** a member pastes an image and then cancels the dialog without saving
- **THEN** the image remains recorded as attached to no task, and is identifiable as such

#### Scenario: Deleting a task with images
- **WHEN** a task whose description holds two images is deleted
- **THEN** both stored objects are removed along with the task
