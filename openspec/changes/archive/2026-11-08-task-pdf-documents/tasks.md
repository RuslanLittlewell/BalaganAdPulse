## 1. Data and rules

- [x] 1.1 Add the `TaskDocument` model with its relations and the migration
- [x] 1.2 Add the document rules to the tasks domain: the PDF check on the bytes, the 20 MB and 10 per task limits, and name sanitizing

## 2. API

- [x] 2.1 Add the document repository and its port, claiming the uploader's unattached documents for a task and listing them in order
- [x] 2.2 Add the document use cases: upload, read with the image access rule, and remove with the task change rule
- [x] 2.3 Add `documentIds` to creating and updating a task, claim them in the task transaction with the 10 limit, delete the stored files when a task is deleted, and return `documents` on the task
- [x] 2.4 Add the `/api/task-documents` routes with the 20 MB upload and the serving headers, wire them, and document them in OpenAPI
- [x] 2.5 Tests: the PDF check, the limits, access for readers and for members without a grant, the unattached rule, removal rules, deleting a task, the task carrying its documents

## 3. Web

- [x] 3.1 Add the document types, the upload, open and remove calls, and the refusal check to `entities/task`
- [x] 3.2 Add the Документы section to the task attachments with upload, list, open and remove, and carry the document ids through the task form
- [x] 3.3 Add the Russian copy to `ru.ts`
- [x] 3.4 Tests: uploading a PDF, the refusals for type and size, opening, removing, and the ids submitted with the task

## 4. Docs

- [x] 4.1 Describe the documents and their limits in the README
