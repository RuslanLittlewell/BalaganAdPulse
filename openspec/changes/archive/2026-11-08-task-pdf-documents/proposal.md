## Why

A task often comes with a brief, a contract or a report as a PDF. Today a task can hold images only, so the file travels by chat and the task points to it in words. The PDF should be attached to the task itself.

## What Changes

- A task can hold PDF documents next to its images. Members upload them from the task dialog, see them listed with their names and sizes, open them and remove them.
- A document is limited to 20 MB, to the PDF type checked from the file's own content, and to 10 documents per task.
- Documents are stored in the same object storage as images and are served only to members who can reach the task. A document not yet attached to a saved task belongs to its uploader.
- Deleting a task removes its documents.
- The task read by the API lists its documents with their ids, names and sizes. Creating or saving a task takes the ids of the uploaded documents to attach.

## Capabilities

### New Capabilities

- `task-documents`: uploading, listing, opening and removing the PDF documents of a task, the limits, who may see them, and what happens to unattached uploads and to a deleted task.

### Modified Capabilities

## Impact

- **API.** A `TaskDocument` table and migration, document use cases and routes under `/api/task-documents`, a `documents` list on the task, and `documentIds` on creating and updating a task. The existing image storage port is reused.
- **Web.** A documents section in the task attachments, an upload and open flow with the existing authenticated download, and Russian copy in `ru.ts`.
- **Assumptions.** PDF is the only document type. 20 MB and 10 documents are the limits, kept as constants.
