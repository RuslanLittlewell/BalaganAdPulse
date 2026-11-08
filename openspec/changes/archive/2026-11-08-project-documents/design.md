## Context

The project page renders the header and then every block of the project in one component.
Project routes live under `ProjectsPage` as `:projectId` and `:projectId/campaigns/:campaignId`.
The task form already edits rich text with TipTap (`@tiptap/starter-kit`, `@tiptap/extension-link`),
but its editor is bound to task images. The API keeps project-scoped resources in their own
modules mounted under `/api/projects/:projectId/…`, as reports are, and checks permissions
against the shared access-policy matrix.

## Goals / Non-Goals

**Goals:**
- One notebook per project, reachable from the project page, readable by the agency and
  written by its admins and managers.
- Editing without a save control, with the last save winning.

**Non-Goals:**
- Images, underline, text colour, checklists and alignment in documents; each needs a new
  TipTap extension package.
- Seeing another member's edits live, or merging concurrent edits.
- Archiving or restoring deleted documents; templates.
- Personal documents visible to their author alone.

## Decisions

- **A `project_document` table**: `id`, `project_id` (cascade on delete), `title`, `content`
  (JSON, nullable), `created_by_id` and `updated_by_id` (memberships, set null when removed),
  `created_at`, `updated_at`. The content is stored whole and replaced whole by each save,
  which is what last-write-wins means; no versions are kept.
- **A `project-documents` API module** at `/api/projects/:projectId/documents`, with list
  (titles, no content), read, create, update (title and/or content) and delete. The project is
  reached through the project repository as the KPI and summary-tile modules reach it; a
  document is looked up within that project, so another project's document answers 404.
- **A `project-document` resource in the access-policy matrix**: read by `ADMIN`, `MANAGER`
  and `GUEST`, written by `ADMIN` and `MANAGER`. The UI asks the same matrix to decide
  whether to show the tabs, the create control, the delete control and an editable editor.
- **Content validation**: a JSON object whose `type` is `doc`, at most 1 MB serialised. The
  editor's schema decides what renders, as it does for task descriptions, and the Link
  extension refuses unsafe protocols when rendering.
- **A larger body limit for documents alone**: the API reads JSON bodies up to 100 KB, which a
  long document's TipTap JSON outgrows. The documents route gets its own parser, mounted before
  the global one, that reads up to 2 MB, so text over 1 MB is refused by validation with a
  clear message; every other route keeps 100 KB.
- **Audit**: `CREATE`, `UPDATE` when the title changes and `DELETE`, with entity type
  `project-document` and the project and client as context. A save that changes only the text
  writes no event.
- **Tabs and addresses**: `:projectId/documents` and `:projectId/documents/:documentId` route to
  the project page, which shows the shared header, the tabs and either the project's blocks or
  the notebook widget. The existing `Tabs` segment is used; switching keeps the query string,
  which carries the period.
- **A document editor of its own** in the notebook widget, on the same TipTap kit as the task
  editor without its image handling, with a toolbar for headings, emphasis, lists, quotes,
  undo and redo. The toolbar button the two editors share moves to `shared/ui`.
- **Autosave**: the open document keeps a draft of its title and text; a change schedules a
  save 800 ms later, a further change reschedules it, and leaving the document or the page
  saves at once. The status line reads Сохраняется…, Сохранено or Не удалось сохранить, next
  to the time and author of the last change. A blank title is not saved.
- **Order**: by creation, oldest first, so a list does not reshuffle while someone types.

## Risks / Trade-offs

- [A slower save overwrites a newer one from the same member] → saves of one document are
  queued, so they reach the server in the order made.
- [Two members editing at once lose one version] → accepted, as asked: the last save wins.
- [The project page keeps loading its figures while the notebook is open] → the queries are
  cached and the page stays one component; splitting it is left for when it grows further.

## Migration Plan

One migration creates `project_document` with its foreign keys and an index on
`project_id`. No existing data changes. Rolling back drops the table.
