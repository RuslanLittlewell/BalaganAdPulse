## Context

See proposal.md — Why. What shapes the approach is the state of the codebase:

- **The foundation this design needs now exists.** `add-org-roles-audit` delivered
  `Organization`, `Membership`, `ClientAccess`, `AuditEvent` and the four roles, so a task
  can name a responsible member and be reached through the same grants as its project.
- **The API is hexagonal.** `adopt-hexagonal-api-architecture` moved every slice into
  `apps/api/src/modules/<module>/{domain,application,infrastructure,presentation}`, wired
  only in `apps/api/src/composition`. Tasks become one more module and follow that
  template; there is no service/controller/route layout left to add to, and an
  architecture test rejects one.
- **Reach is translated in each module's Prisma adapter**, from the actor's role and
  grants into a query filter, and the verb comes from `packages/access-policy`. Reach is
  checked first, so an unreachable record answers 404 rather than 403.
- **Audit is a port.** Mutating use cases append through `AuditWriter` inside the same
  `unitOfWork.run` as the change, so the trail cannot disagree with the data.
- **`/tasks` is already routed.** `ROUTES.tasks` renders `ModulePage` with the
  "module not implemented" copy. There is a slot to fill, not a route to add.
- **Ordering has a precedent.** `Project.position` is a plain integer, and the campaigns
  module already renumbers a column densely inside a transaction — the board's move is the
  same shape.
- **Storage is avatar-shaped.** `shared/infrastructure/storage.ts` exposes only
  `putPng`/`getPng`, hardcoding `ContentType: "image/png"`, and `shared/presentation/avatar.ts`
  caps uploads at 1 MB against a PNG magic number. Avatar bytes reach the browser as data
  URLs because `<img src>` cannot carry the bearer token — the same obstacle applies to task
  images, at a different scale.
- **The web app has neither a drag-and-drop library nor a rich-text editor**, and runs
  React 19. `ProjectPriority` still exists and still describes a project by counting its
  tasks, so a task priority of its own is still the right call.

The board's column order is taken literally from the request — Идея, Архив, В работе, На
исправление, На проверке, Готово — including `ARCHIVED` sitting second rather than last.
Order lives in one exported constant, so moving it is a one-line change if that was a typo.

## Goals / Non-Goals

**Goals:**

- A move is atomic: after any single drag, the affected columns hold a dense, gap-free
  order, whether the drag succeeded or was rejected.
- Image bytes never travel inside a task payload, so listing a board stays cheap no matter
  how many screenshots the descriptions hold.
- A task description cannot become an XSS vector, and this is guaranteed by the shape of
  what is stored rather than by remembering to escape at render time.
- Reuse the foundation's access rules rather than restating them: whether a member reaches
  a task is derived entirely from whether they reach its project.

**Non-Goals:**

- Real-time collaboration. Two members dragging the same card resolve last-write-wins; no
  websockets, no presence, no live board sync.
- Board pagination or virtualization. The list endpoint returns every reachable task.
- An automated sweep of abandoned images. The data to find them is recorded; the job that
  acts on it is a follow-on.

## Decisions

### The board is a module like any other

`modules/tasks` holds the domain (columns, priorities, position rules), the use cases and
their ports, a Prisma adapter that translates reach, and an HTTP adapter with the Zod
schemas. Composition wires it. Images are a second concern inside the same module rather
than a module of their own: they exist only as part of a task's description, and splitting
them would put a cross-module port between a task and its own attachment.

### Positions are dense integers, renumbered per column inside the move transaction

A move sends `{ column, position }`. The service renumbers the source column and the target
column to `0..n-1` in one `prisma.$transaction`, so a column can never end up with duplicate
or gapped positions.

Alternatives considered. *Fractional indexing / LexoRank* — writes only the moved row, which
matters when columns hold thousands of cards and several people drag at once; rejected
because it needs a rebalancing path of its own and a string ordering key that reads badly in
the database, to solve a scale this board will not reach. *Appending with a `count()`, as
`Project.position` does* — has no answer for insertion into the middle, which is the whole
operation here. Renumbering touches every row in at most two columns; at the tens of cards a
column realistically holds, that is a cheap statement inside a transaction that is already
open for the audit event.

Concurrency is left at last-write-wins deliberately: the transaction guarantees the board is
never *inconsistent*, only that the loser of a race sees their card somewhere they did not
put it, which a reload corrects.

### `@dnd-kit` for drag-and-drop

`@dnd-kit/core` with `@dnd-kit/sortable`, and the keyboard sensor enabled so a card can be
moved without a mouse.

Alternatives considered. *`react-beautiful-dnd`* — the canonical Trello-like library, but it
is no longer maintained and does not support React 19, which the app runs. *`react-dnd`* — a
general HTML5 drag-and-drop abstraction rather than a sortable-list library; it would leave
the placeholder animation and the drop-position maths to be written by hand. *Native HTML5
drag events* — no keyboard path and no touch support without writing both.

### TipTap, storing the description as a ProseMirror JSON document

The description column is Prisma `Json`, holding the ProseMirror document TipTap produces,
not an HTML string.

This is what makes the "description cannot carry active content" requirement structural: the
document is parsed against the editor's schema on the way in, and any node or mark the
schema does not define is dropped. There is no place in the stored shape for a `<script>` or
an `onerror=` to survive, so nothing depends on remembering to sanitize before rendering.
Rendering goes back through the same schema.

Alternatives considered. *HTML plus a sanitizer* (`sanitize-html`, DOMPurify) — one
forgotten call site, or one sanitizer-bypass CVE, is an XSS; the safety is a runtime promise
rather than a property of the data. *Markdown* — was the other option offered, and loses the
paste-a-screenshot-inline experience that motivated the field. *Lexical / Slate* — comparable
editors; TipTap wins on having the paste-and-drop image handling as a documented extension
point rather than something to build.

The trade-off is that the description is no longer greppable with a `LIKE` query. Full-text
search over tasks is not in this change; when it arrives it will need a derived plain-text
column, and that is cheap to add later.

### Images are fetched with credentials and rendered from object URLs

The editor does not put the API address in `<img src>`. It fetches `/api/task-images/:id`
with the member's bearer token and renders the result from an `URL.createObjectURL` blob,
revoking it on unmount.

Alternatives considered. *Data URLs, as avatars use* — consistent with the existing code and
needs no fetch, but it puts the bytes in the task payload; a board of forty tasks each
carrying two screenshots becomes a multi-megabyte JSON response, which is exactly what the
"bytes never travel inside a task payload" goal rules out. It stays right for avatars, which
are one small PNG on a record already being fetched. *An unguessable public URL* — makes
`<img src>` work directly, but turns every screenshot into a permanent public link, which is
the wrong default for client work. *A short-lived signed URL* — secure and `<img>`-friendly,
but needs a signing scheme, a clock-skew story and a refresh path for an editor left open;
disproportionate here.

### `TaskImage` rows carry the uploader, and the task once it is known

An upload creates a `TaskImage` with `uploaderId` set and `taskId` null, because the task it
belongs to does not exist yet when the paste happens. Saving a task walks the description
document for image references and claims them. Access is: the uploader always, plus anyone
who can reach the claimed task.

This is what lets an abandoned upload be found — `taskId IS NULL AND created_at < now() -
interval` is the sweep query, left for a follow-on to run.

### Storage grows a content-type-agnostic pair, and avatars keep their path

`putObject(key, body, contentType)` and `getObject(key)` join
`shared/infrastructure/storage.ts`, and `putPng`/`getPng` are re-expressed as thin wrappers
over them. Avatar call sites, the avatar size cap and the PNG magic-number check are
untouched — task images get their own limit (10 MB) and their own accepted-type list,
validated by magic number inside the tasks module rather than by widening
`assertAvatarPng`.

Widening the avatar validator was the alternative; it would let a 10 MB GIF through as a
profile picture.

### Task priority is a new enum

`TaskPriority` — `LOW`, `MEDIUM`, `HIGH`, `URGENT` — rather than reusing `ProjectPriority`,
whose members (`IDLE` "нет задач", `URGENT` "есть срочные задачи", `NEW` "новый") describe a
project by summarising the tasks under it. Applied to a task they read as nonsense, and the
two scales would then be unable to evolve apart.

### The board is one query, filtered client-side by project, assignee and priority

`GET /api/tasks` returns every task the member reaches, ordered by column then position, and
the board groups them. Filters are applied in the browser.

The alternative — a request per column, or server-side filters — is better once a board holds
thousands of cards. At the size this agency's board will hold, one query keeps drag-and-drop
instant, because a filter change does not refetch. `GET /api/tasks?projectId=` is accepted as
well, so the endpoint is already shaped for server-side filtering when it is needed.

### The `CLIENT` role is refused tasks outright

Not "sees an empty board" — refused. The board carries the agency's internal notes about a
client's own work, and the client portal is a separate follow-on that will decide what a
client should see. Defaulting to closed keeps the decision open.

## Risks / Trade-offs

- **Two members dragging the same card race, and the loser sees a card they did not place**
  → The transaction keeps the board internally consistent; a reload is the correction. Live
  sync is an explicit non-goal.
- **Renumbering a column writes every row in it** → Bounded by column size, inside one
  transaction. If a column ever grows past a few hundred cards, the move endpoint is the one
  place to change, and fractional indexing slots in behind the same API.
- **Abandoned images accumulate in storage and cost money** → Every upload is recorded with
  its uploader and time, so the sweep query is trivial; the job that runs it is a follow-on,
  and until it exists the growth is bounded by how often someone cancels a dialog.
- **TipTap adds meaningful weight to the bundle** → Import only the extensions used
  (StarterKit plus Image) and load the editor lazily with the dialog, so the board itself
  does not pay for it.
- **Blob object URLs leak memory if not revoked** → Revoke in the effect cleanup that
  created them; a test asserts revocation on unmount.
- **`Json` descriptions are not searchable by SQL** → Accepted; full-text search is not in
  this change and a derived plain-text column can be added when it is.

## Migration Plan

Additive only. No existing table, column or row is touched, so **existing data survives
untouched** — this change needs no wipe and no backfill.

1. Two enums: `task_column` (`IDEA`, `ARCHIVED`, `IN_PROGRESS`, `NEEDS_FIX`, `IN_REVIEW`,
   `DONE`) and `task_priority` (`LOW`, `MEDIUM`, `HIGH`, `URGENT`).
2. `task` — id, `project_id`, `org_id`, `title`, `description` (`Json`, nullable), `column`,
   `priority`, `assignee_id` (nullable, → `membership`, `ON DELETE SET NULL` so removing a
   member leaves their tasks standing), `created_by_id`, `position`, timestamps. Indexed on
   `(org_id, column, position)` for the board read and `(project_id)` for the filter.
3. `task_image` — id, `task_id` (nullable, → `task`, `ON DELETE CASCADE`), `uploader_id`,
   `storage_key`, `content_type`, `bytes`, `created_at`. Indexed on `(task_id)` and on
   `(taskId IS NULL, created_at)` for the sweep.

Rollback is `DROP TABLE task_image, task` and the two enums; nothing outside this change
references them. `membership`, `project` and `organization` are only referenced, never
altered. Render already runs migrations as a pre-deploy step, so a failure there
stops the deploy with the old code still serving.

Storage needs no migration: task images go to the existing bucket under a `tasks/` prefix,
which cannot collide with the `users/` and `clients/` prefixes already in use.

## Open Questions

- Whether the `ARCHIVED` column should be collapsed by default once it fills up. It is drawn
  like any other column for now; collapsing is a UI change that touches no spec.
- Whether the abandoned-image sweep should run as a scheduled job on Render or as a manual
  script. The data supports either, and nothing else depends on the answer.
