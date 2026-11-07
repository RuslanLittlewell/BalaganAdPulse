## Context

Leads live in the `leads` module. A board is a project, and its key is the project id. Every mutation runs through `mutation()` in `lead-use-cases.ts`: it checks reach and permission, takes a per-board advisory lock (`pg_advisory_xact_lock` on `orgId:board`), reads the board's leads inside the transaction, writes, appends an audit event and publishes `crm.changed`. Custom columns (`lead_column`) follow the same pattern, and their permissions map to the `lead` resource: create, update and delete. The audit event for a lead carries whole `before` and `after` snapshots, and `buildActivity` diffs a fixed list of tracked fields from them.

On the web, `entities/lead` holds the queries, `useCrmEvents` invalidates the board's queries on `crm.changed`, and `features/lead-management/ui/LeadCard.tsx` renders the fields as `Row`s inside a react-hook-form form. `shared/ui` already has `DatePicker`, `MultiSelect` and `SpringCheck`.

This change is the first of eight (see proposal.md). Later changes add a table, saved views with filters and sorts, companies and contacts, a record page, search and CSV, automations, and email sync. The storage choice below has to serve them too.

## Goals / Non-Goals

**Goals:**
- One field registry per board that later changes reuse for table columns, filters, sorts, CSV mapping and automation conditions.
- Values validated in the domain, written only under the board lock.
- No new permission resource: field management follows column management.

**Non-Goals:**
- Showing custom values on the board card. The saved-views change will choose card fields per view.
- Filtering or sorting by custom values, and the indexes for that.
- Mapping Meta form answers into custom fields.
- Changing a field's type, or copying fields between boards.
- Currency, person, relation, rating or address field types. Relations arrive with companies and contacts.

## Decisions

### Values live in a JSONB column on the lead

`lead.custom_values` is a JSONB object keyed by field id. It holds only fields that have a value.

- Text, number, date and link values are strings.
- A checkbox value is `true`.
- A Список value is an option id; a Несколько из списка value is an array of option ids.

Alternatives considered:
- An entity-attribute-value table (`lead_field_value` with typed columns) gives SQL-friendly sorting but adds a row per value and a join to every board read, and partial updates become upserts and deletes.
- A real database column per field, as Twenty does, needs DDL at runtime, which Prisma cannot model.

JSONB keeps a board read a single query and makes removing a field one `custom_values - $id` update. When saved views need filtering, a GIN index plus expression casts cover it.

Numbers are stored as decimal strings with exactly four decimals, the form the API already uses for the deal amount. This keeps precision and lets the table change sort them later by casting. Dates are stored as `YYYY-MM-DD` strings, not timestamps, because a field date is a calendar day with no time zone.

### Field definitions in `lead_field`, options inline as JSON

`lead_field` has these columns:
- `id`, `org_id`;
- `project_id`, cascading on project delete;
- `name` (varchar 50);
- `type`, a new enum `lead_field_type` with the values TEXT, NUMBER, DATE, SELECT, MULTI_SELECT, CHECKBOX and LINK;
- `options` (JSONB array of `{id, name, color}`);
- `position`;
- timestamps.

It has an index on `(project_id, position)`.

Options are always read with their field, number at most 50, and are edited as one ordered list. A separate table would turn every option edit into several writes for no gain.

Colors are stored as palette keys (`gray`, `red`, `orange`, `yellow`, `green`, `teal`, `blue`, `purple`), not hex values. The web maps each key to theme tokens, so dark mode and later redesigns need no data change.

### Options are edited by sending the whole list

`PATCH /fields/:id` accepts `options: [{id?, name, color}]` in the new order.
- An entry with a known id keeps that option's identity.
- An entry without an id is a new option, and the server assigns it an id.
- An id the field does not have is refused with 400.
- A current option missing from the list is removed. The server strips it from every lead's value in the same transaction and records the affected lead ids in the audit event.

Separate option endpoints were considered. The dialog edits options as a list and saves once, so one request matches the interaction and keeps the transaction single.

### Field use cases share the board lock

A new `createLeadFieldUseCases` in `leads/application` takes `LeadFieldRepository` and the existing `LeadRepository` for `reaches`, `lock` and lead value cleanup. It also uses the audit writer, unit of work, ids and publish. It reuses the same `mutation` shape: check, lock, recheck, write, audit, publish. To share it, the helper moves out of `createLeadUseCases` into `application/board-mutation.ts`. Permissions are `can(actor, 'create' | 'update' | 'delete', 'lead')`, the same as columns.

`createLeadUseCases` gains the `LeadFieldRepository`. Inside the lock, create and update load the board's fields and call the domain function `applyCustomValues(fields, current, patch)`. That function rejects unknown ids and invalid values, normalizes each value, drops empties, and returns the merged object. The function, the type rules and `BUILT_IN_FIELD_NAMES` (used for the name check) live in `leads/domain/lead-field.ts`, beside the column rules.

### The card sends only changed custom values

The lead card form keeps custom values under `custom.<fieldId>`. On save, `bodyOf` sends `customValues` with only the fields react-hook-form marks dirty. The API merges named fields and keeps the rest, so two members editing different custom fields of the same lead do not overwrite each other. Built-in fields keep their current whole-body behavior. Changing that is outside this change.

### Activity resolves names at read time

The lead's audit snapshots already include `customValues`, because the snapshot is the whole record. `buildActivity` receives the board's current fields beside the column and campaign names. It diffs `customValues` for each field that still exists and emits a `{ field: 'custom', name, type, before, after }` change. List values come out as arrays of option names, with `null` standing for a removed option. The web formats these:
- a checkbox as Да or Нет;
- a date as `ДД.ММ.ГГГГ`;
- `null` as удалённый вариант.

All three strings come from `ru.ts`, so the API emits no Russian beyond the stage names it already returns. Changes to deleted fields are skipped because their ids no longer resolve. Storing names in the snapshot would show history for deleted fields, but it would freeze renamed names too.

### Web structure

- `entities/lead`:
  - `LeadField` and `CustomValue` types;
  - `leadFieldsKey(boardKey)`, `useLeadFields`;
  - mutations for create, update and delete;
  - `useCrmEvents` also invalidates the fields key.
- New feature `features/lead-field-management`: `LeadFieldsButton`, which renders its own `Button`, and `LeadFieldsDialog`, which lists fields and holds the add and edit form, the option editor with color swatches, move controls and the delete confirmation. `CrmPage` renders `LeadFieldsButton` when `board.capabilities.create`.
- `features/lead-management`: `CustomFieldRow` switches on the type and uses `DatePicker`, `MultiSelect`, `SpringCheck` and inputs. A link opens with `target="_blank" rel="noopener noreferrer"`. `LeadActivityTab` formats custom changes.

## Risks / Trade-offs

- [JSONB has no foreign key, so a value can outlive its field or option] → All writes go through the use cases under the board lock: field deletion and option removal strip values in the same transaction. Reads ignore keys that match no field.
- [Sorting and filtering custom values in later views is slower than on real columns] → Boards hold hundreds to low thousands of leads. The saved-views change adds a GIN index and casts, and can measure the result.
- [Audit snapshots grow with custom values, up to 30 × 2000 characters per side] → This is acceptable at current volume. If it becomes a problem, snapshots can store only changed keys, with no spec change.
- [Moving `mutation` into a shared helper touches every lead and column use case] → The existing lead and column API tests cover them unchanged, and the move is behavior-neutral.
- [A field name equal to a built-in row is checked against Russian labels kept in the domain] → The domain already keeps the Russian stage names for the same reason. The list sits in one constant that a test pins.

## Migration Plan

One additive migration:
1. Create the enum `lead_field_type`.
2. Create the table `lead_field` with its foreign keys to `organization` and `project` (cascade) and its index.
3. Add `custom_values JSONB NOT NULL DEFAULT '{}'` to `lead`.

Existing leads, columns and audit history survive unchanged, and every lead starts with an empty value set. The api container applies the migration on start through `migrate deploy`. The nightly backup on production covers rollback. A manual rollback drops the column, the table and the enum, which loses only custom field data entered after the deploy.
