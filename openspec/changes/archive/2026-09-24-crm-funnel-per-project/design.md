## Context

A board key is either `agency` or a client id. `lead.client_id` (nullable, null for the agency)
and `lead_column.client_id` place rows on boards; `lead.project_id` is an optional attribution
that `SET NULL`s when the project is deleted. Board reach is computed from client-wide grants
only. The Meta intake already knows the project it imports for and passes the client along to
pick the board. The web treats the board key as an opaque string, except for `AGENCY_BOARD` in
the lead form.

## Goals / Non-Goals

**Goals:** a board per project, keyed by project id; the migration the user chose; reach equal
to project reach.

**Non-Goals:** moving leads between projects; keeping deleted data anywhere; changing stage
counts beyond what reach already implies; per-project column templates.

## Decisions

- **The board key is the project id.** URLs, realtime events and the remembered board keep
  their shape; only the value changes. The web needs no routing change.
- **The project is the only placement.** `lead.client_id` and `lead_column.client_id` are
  dropped rather than kept in sync: a project can move to another client, and a denormalized
  client id would then be wrong. Anything that needs the client (audit's `clientId`) reads it
  through the project.
- **`lead.project_id` is required and cascades,** and `lead_column.project_id` is added the same
  way. A funnel cannot outlive its project. This replaces the old "lead survives with no
  project" rule.
- **Requests may not name a project.** `projectId` is removed from the create and update
  schemas, which are strict, so sending it is a 400. The server sets it from the board. This is
  simpler than accepting a value that must equal the board.
- **Reach reuses the project reach rule:** admin sees the org; others need a grant naming the
  project or its whole client. Customers already hold whole-client grants, so they reach their
  client's projects. `boards()` lists reachable projects ordered by client name, then project
  position, each with its client's name.
- **Assignees** must hold a grant naming the board's project or its whole client, and be active,
  as before but scoped to the project.
- **The board lock** keys on `org:projectId`, both in member mutations and in the Meta intake,
  so the two still serialize on the same board.

## Migration Plan

One Prisma migration, in order, inside its transaction:

1. Delete leads with `client_id IS NULL` (the agency funnel) and leads with `project_id IS NULL`.
2. Move leads in custom columns to `NEW` (`column_id = NULL`, `stage = 'NEW'`), keeping them after
   the leads already in `NEW`, then delete every `lead_column` row.
3. Renumber `position` per `(project_id, stage)` by existing order, since positions were numbered
   per client and now must be per project.
4. Drop `lead.client_id` and its foreign key and index; make `lead.project_id` `NOT NULL` with
   `ON DELETE CASCADE`; replace `lead_column.client_id` with a required `project_id`
   (`ON DELETE CASCADE`) and index it.

`meta_lead` rows of deleted leads keep their external id with `lead_id` set to null, so a later
poll does not re-import a lead the migration deleted.

The deleted data does not survive and rollback cannot restore it. `deploy/deploy.sh` runs the
migration without taking a backup, so `deploy/backup.sh` must be run on the server before the
deploy that carries this migration; that dump is the only way back.

## Risks / Trade-offs

- [Irreversible data loss in production] → Stated as **BREAKING** in the proposal; confirmed
  with the user; a manual `deploy/backup.sh` run must precede the deploy.
- [A project-only grant now opens a CRM board] → Intended: reach follows the project. Spec'd.
- [Deleting a project now deletes leads] → Intended; spec'd and covered by a test.
