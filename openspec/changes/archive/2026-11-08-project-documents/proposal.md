## Why

What the agency knows about a project — what it is, the strategy agreed with the client, who
the competitors are — lives in chats and personal notes, so a member joining a project
starts from nothing and the agreed strategy is never where the figures are. Each project
needs its own internal notebook.

## What Changes

- A project page gains tabs under its header: Проект, holding everything it shows today,
  and Документы, the project's notebook.
- The notebook lists the project's documents and opens one beside the list. A document has a
  title and rich text: headings, emphasis, lists, quotes and links.
- Admins and managers who reach the project create, rename, edit and delete documents;
  guests who reach it read them; customers neither see the tab nor reach the documents.
- A document saves itself as it is edited; when two people edit it, the last save wins.
- Deleting a document asks for confirmation and removes it for good.
- Creating, renaming and deleting a document are recorded in the project's activity.

## Capabilities

### New Capabilities
- `project-documents`: a project's internal notebook of rich-text documents.

### Modified Capabilities

## Impact

- Prisma: a `project_document` table, with a migration.
- `apps/api/src/modules/project-documents`: a new module under
  `/api/projects/:projectId/documents`. `packages/access-policy`: who reads and writes
  documents.
- `apps/web`: a `project-document` entity, a `project-documents` widget with its editor,
  tabs on the project page and routes for the notebook, copy in `ru.ts`.
