## Context

See proposal.md for the motivation and specs/task-documents/spec.md for the behavior.

Task images are rows in `task_image` with an object in storage. They are referenced from the rich-text description, and saving the description claims the uploader's unattached images by id. The image use cases upload, read and remove through a `TaskImageStorage` port over the S3-compatible storage, and an authenticated route serves the bytes. The web fetches images with the access token and shows them through object URLs.

## Goals / Non-Goals

**Goals:**
- Reuse the image storage, authorization rules and download pattern, so documents behave like images wherever the spec says so.
- Keep documents out of the description, since a PDF is not shown inline.

**Non-Goals:**
- Other file types, previews of PDF pages, and text search inside documents.
- Versioning, folders or sharing links.
- Documents on comments and on projects, which has its own `project-documents` notebook.

## Decisions

### A separate `TaskDocument` table, not a widened `TaskImage`

`TaskImage` ties its id to references inside the description and carries only a content type. A document needs a name and is attached by an explicit list. Widening the image table would make every image rule carry exceptions, so documents get their own table with `id`, `taskId`, `uploaderId`, `name`, `storageKey`, `bytes` and `createdAt`, cascading with the task and the uploader.

The object key is `tasks/documents/<id>`, never the file name, so a name cannot address storage. The original name is kept sanitized: path separators and control characters removed, at most 200 characters, and `document.pdf` when nothing remains.

### Attaching by explicit ids

Creating or updating a task accepts `documentIds`. The task use case claims the uploader's unattached documents among them, in the same transaction as the task change, the way images are claimed. A claim that would bring the task over 10 documents fails before anything is written. Removal is its own request, as for images, so editing a task never silently deletes a document that was left out of a list.

### Type and size are checked on the bytes

The upload route reads the file into memory with a 20 MB limit, as the image route does for 10 MB. The use case accepts it when it starts with `%PDF-` within its first 1024 bytes, which is where the PDF specification allows the header. The declared content type and the extension are ignored. The stored and served content type is always `application/pdf`.

Alternative: parse the PDF to confirm it is valid. That adds a parser dependency and rejects damaged files that viewers can still open, for no safety gain, since the file is only served back and never rendered by the server.

### Serving

`GET /api/task-documents/:id` answers the bytes with `Content-Type: application/pdf`, `Content-Disposition: inline` with the name in the `filename*` form, `X-Content-Type-Options: nosniff` and `Cache-Control: private`. The access rule is the image rule: an unattached document belongs to its uploader and an attached one to whoever can reach its task. The web fetches it with the token, makes an object URL and opens it in a new tab, because a plain link cannot carry the token.

### The task read carries the list

`TaskRecord` gains `documents`, a list of id, name and size. The task repository selects it with the task, as it does image ids, so the dialog and the events carry it with no extra request.

### Web

`TaskAttachments` gets a second section, Документы, under the images: a paperclip for PDF files, the list with name, size, open and remove controls, and the same refusal messages beside it. The form keeps the uploaded documents in its state and submits their ids with the task. The component that owns the buttons renders them, and the parent passes `canEdit` style props.

## Risks / Trade-offs

- [A PDF can carry active content] → the server never renders it, serves it with `nosniff` and as a download-safe type, and the browser's PDF viewer applies its own sandbox.
- [Abandoned uploads fill storage] → they are recorded with an uploader and a time, as images are. A cleanup job can follow, as it can for images.
- [20 MB files held in memory during upload] → the limit bounds it, and uploads are one file per request.
- [A name with odd characters in a header] → names are sanitized on upload and encoded with `filename*` on download.
