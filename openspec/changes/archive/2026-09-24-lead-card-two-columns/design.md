## Context

Leads are rows of `lead`, reached through a project board (`/crm/boards/:projectId/...`). The web
opens `LeadFormDialog`, a single-column form. Every lead mutation already writes an audit event
whose `changes` hold the lead record before and after, or the stage and position before and
after for a move. Task images show the upload path to copy: multer in memory, bytes in S3 under
a key, a row describing them, authorization on read through the owning record.

## Goals / Non-Goals

**Goals:** the two-column card with the fixed field set; amount and tags; files; activity.

**Non-Goals:** chat and tasks tabs; user-defined fields; a contacts book; filtering by tags;
previews of files; editing on blur.

## Decisions

- **New fields are columns on `lead`,** not a key-value table, because the set is fixed:
  `amount DECIMAL(18,4)`, `service`, `telegram`, `messenger` (nullable `VARCHAR`),
  and `tags TEXT[] NOT NULL DEFAULT '{}'`. Tags stay on the lead; board suggestions are the
  distinct tags of the board's leads, which the web already holds, so no tag endpoint is needed.
- **Amount travels as a string.** The schema accepts `^\d{1,14}(\.\d{1,4})?$` or null and the API
  returns it with four decimals, following the project's rule for money. The currency is the
  board project's `budgetCurrency`; nothing is stored per lead.
- **Files** live in a `lead_file` table (`id`, `lead_id` cascading, `org_id`, `name`,
  `content_type`, `bytes`, `storage_key`, `uploader_id` set null on delete, `created_at`) with the
  bytes in S3 under `leads/files/<id>`. Routes nest under the lead:
  `GET|POST /crm/boards/:board/leads/:id/files`, `GET|DELETE .../files/:fileId`. Reach is the lead's
  board reach; upload and delete need `update` on leads, list and download need `read`.
  Multer reports non-ASCII names in latin1, so the name is re-decoded as UTF-8.
- **Downloads are always attachments** with `Content-Type: application/octet-stream`,
  `X-Content-Type-Options: nosniff` and an RFC 5987 `filename*`. Any type is accepted, so nothing
  uploaded may be rendered by our origin.
- **File events are audited on the lead** (`entityType: 'lead'`, `entityId: leadId`,
  `UPDATE`, `changes: { fileAdded | fileRemoved: { id, name } }`) so a lead's history is one audit
  query.
- **Activity is a read model over the audit trail,** served by
  `GET /crm/boards/:board/leads/:id/activity`. It reads the lead's audit events and turns each
  into an entry: `created`, `moved` (stage ids resolved to fixed-stage or column names), `changed`
  (a diff of the tracked fields between the before and after records, with the assignee and
  campaign shown by name) or `file-added`/`file-removed`. An update that changes no tracked field
  yields no entry. An imported lead gets an `imported` entry at its form submission time. Serving
  a read model keeps the raw before/after records — which include every contact field — off the
  wire and puts the Russian wording in the web, where copy belongs.
- **The campaign stays in the API but leaves the card.** Imports set it and the dashboard's
  attribution reads it; the API still accepts it, only the card stops offering it.
- **The integration's data is a tab, not a section.** `LeadSourceSection` moves unchanged into a
  Доп. информация tab offered only when the lead has a Meta source.
- **The card is a new component, `LeadCard`,** replacing `LeadFormDialog`. It keeps react-hook-form
  and the explicit Создать/Сохранить buttons the user chose. Its right column uses the shared
  `Tabs` with two items.

## Risks / Trade-offs

- [Deleting a project or client cascades its leads and file rows but not the S3 objects] →
  Lead deletion through the API removes objects; cascades leave orphans, as task images already
  do. Accepted for now.
- [Activity depends on audit events written before this change] → Their before/after records
  lack the new fields, which then simply do not appear as changed.

## Migration Plan

One migration adding the four columns, the tags array with its default, and the `lead_file`
table. Existing rows keep their data; the new fields start empty. Rollback drops them.
