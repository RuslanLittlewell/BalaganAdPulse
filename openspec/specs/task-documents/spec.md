# task-documents Specification

## Purpose
Let a task carry PDF documents, such as a brief or a contract, so the file lives with the work and is seen only by the people who can see the task.

## Requirements

### Requirement: PDF documents are attached to a task

The attachments of a task being created or edited SHALL offer a way to upload PDF documents, more than one at a time. Each uploaded document SHALL be listed with its file name and size and SHALL be saved with the task. A task SHALL hold at most 10 documents.

#### Scenario: Attaching a PDF
- **WHEN** a member chooses a PDF file in the task dialog and saves the task
- **THEN** the document is uploaded, listed with its name and size, and still listed when the task is opened again

#### Scenario: Too many documents
- **WHEN** a member tries to save a task with an eleventh document
- **THEN** the API responds 400 and the task keeps its ten documents

### Requirement: Uploads are limited by type and size

An upload SHALL be accepted only for a PDF of at most 20 MB. The type SHALL be determined from the file's own content, not from its name or declared content type. A refused upload SHALL store nothing and SHALL leave the task as it was.

#### Scenario: A PDF
- **WHEN** a 3 MB PDF is uploaded
- **THEN** it is stored and can be attached to a task

#### Scenario: Too large
- **WHEN** a 25 MB PDF is uploaded
- **THEN** the API responds 400, nothing is stored, and the member is told the file is too large

#### Scenario: Not a PDF
- **WHEN** a Word file renamed to .pdf is uploaded
- **THEN** the API responds 400, nothing is stored, and the member is told only PDF files can be uploaded

### Requirement: A document is served only to members who can read its task

Opening a document SHALL require the same authentication as every other endpoint and SHALL be permitted only to a member who can reach the task the document belongs to. A document whose task is unreachable SHALL answer 404. Between upload and the save of the task that attaches it, a document SHALL be reachable only by the member who uploaded it. A document SHALL be served with its original file name and as a PDF, so a browser opens it in a tab or downloads it under that name.

#### Scenario: A member without access
- **WHEN** a member requests a document of a task in a project they hold no grant for
- **THEN** the API responds 404

#### Scenario: Another member guesses the identifier
- **WHEN** a member requests an uploaded document that no saved task holds and that they did not upload
- **THEN** the API responds 404

#### Scenario: Opening a document
- **WHEN** a member who can reach the task opens a listed document
- **THEN** the PDF opens under its original name

### Requirement: Documents can be removed

A member who may change a task SHALL be able to remove one of its documents. A member SHALL be able to remove a document they uploaded and have not yet attached. Removing a document SHALL delete its stored file. Deleting a task SHALL delete the stored files of all its documents.

#### Scenario: Removing a document
- **WHEN** a member who may edit the task removes one of its documents
- **THEN** the document disappears from the task and its stored file is deleted

#### Scenario: Deleting a task
- **WHEN** a task with two documents is deleted
- **THEN** both stored files are deleted with it

#### Scenario: A member who may not change the task
- **WHEN** a member who can read a task but may not change it tries to remove its document
- **THEN** the API responds 404 and the document stays

### Requirement: Abandoned uploads can be found

Each uploaded document SHALL be recorded with its uploader, the task it belongs to once known, and its upload time, so a document whose task was never saved can be found later.

#### Scenario: The dialog is cancelled
- **WHEN** a member uploads a PDF and cancels the dialog without saving
- **THEN** the document stays recorded as attached to no task
