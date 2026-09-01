## Why

`/tasks` is a placeholder: the navigation names the module, and the screen behind it says
the section is not implemented yet. The agency's work is already organised around
projects, but what anyone is actually doing on a project lives outside the system — in
chat, in someone's head, in a spreadsheet. A board makes that work visible: who is
responsible, how urgent it is, and which stage it has reached.

This change turns the placeholder into a Kanban board with drag-and-drop, and gives a
task the one thing chat cannot carry well — a description with the screenshot pasted
straight into it.

## What Changes

- A `Task` arrives, belonging to exactly one project: a title, a rich-text description,
  a column, a responsible member, a priority and a position within its column.
- The board at `/tasks` replaces the "module not implemented" screen. Six columns, in
  this left-to-right order: Идея, Архив, В работе, На исправление, На проверке, Готово
  (`IDEA`, `ARCHIVED`, `IN_PROGRESS`, `NEEDS_FIX`, `IN_REVIEW`, `DONE`).
- Cards are dragged between columns and reordered within a column. The move is persisted
  the moment it lands, and the board shows the new position before the server answers.
- A task is created through a dialog: title, description, and three selects — project,
  responsible member, priority. Project, title and priority are required; the responsible
  member is optional, because work is often filed before it is assigned.
- The description is rich text. Images are pasted with Ctrl+V or dropped onto the editor,
  are uploaded as they land, and are stored as objects in S3 rather than inside the
  description.
- Task priority is its own scale — `LOW`, `MEDIUM`, `HIGH`, `URGENT` — rather than the
  existing `ProjectPriority`, whose values (`IDLE` "нет задач", `URGENT` "есть срочные
  задачи") describe a project's state by counting its tasks and read as nonsense on a
  task itself.
- Tasks are read, written and deleted under the same rules as the project they belong to:
  reachable through the member's grants, refused to guests on every write, and recorded in
  the audit trail like every other mutation.

No breaking changes. Nothing is removed and no existing endpoint changes shape; the module
is additive, and `/tasks` today renders a placeholder with no behaviour to preserve.

**Prerequisite.** This change is planned on top of `add-agency-crm-foundation`, which
introduces `Organization`, `Membership` and the four roles. That change is archived but
its schema was never built: `openspec/specs/` is empty, and the database still has
`Client.ownerId` and `Campaign` rather than `Client.orgId` and `Sheet`. The responsible
member select has no candidates until the foundation exists, so the foundation must be
implemented before this change starts.

## Capabilities

### New Capabilities

- `task-board`: tasks under a project — their fields, the six columns, ordering within a
  column, moving between columns, and who may read or change them.
- `task-images`: uploading an image pasted or dropped into a task description, storing it,
  and serving it back to the editor.

### Modified Capabilities

None. `openspec/specs/` holds no capabilities yet — `add-agency-crm-foundation` was
archived without its deltas being synced — so this change has nothing to write a delta
against and introduces its capabilities whole.

## Impact

- **Schema**: new `task` table and two enums, `task_column` and `task_priority`. A task
  references its project, its organization, the membership responsible for it, and the
  membership that created it. New `task_image` recording each uploaded object so an
  orphaned upload can be found. No existing table changes, so existing data survives.
- **API**: new `/api/tasks` (list, create, read, update, delete), `/api/tasks/:id/move`
  for the drag-and-drop landing, and `/api/task-images` for the upload. All under the
  existing `requireAuth` and the foundation's access rules.
- **Storage**: `apps/api/src/lib/storage.ts` is PNG-only (`putPng`/`getPng`) and sized for
  1 MB avatars. It gains content-type-agnostic put and get so a pasted JPEG or WebP is not
  rejected, and task images get their own size limit — the avatar path keeps its own.
- **Dependencies**: a drag-and-drop library and a rich-text editor, neither of which the
  web app has today. `apps/web` gains `@dnd-kit/*` and `@tiptap/*`.
- **Frontend**: `pages/tasks` replaces the `ModulePage` placeholder on `ROUTES.tasks`, a
  `widgets/task-board`, a `features/task-management` holding the create/edit dialog and the
  editor, and an `entities/task`. Russian copy joins `shared/config/ru.ts`.
- **Out of scope, each a follow-on**: due dates, comments, checklists, labels, several
  assignees per task, file attachments that are not images, notifications, and a per-project
  board view. The board is global and filtered, not one board per project.
