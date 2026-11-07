## Why

Every lead carries the same fixed set of fields, so a board cannot record what its client's sales process needs: a budget range, a meeting date, a product line, a yes-or-no qualification answer. Teams put this in the description or in tags, where it cannot be compared, sorted or filtered. We want the CRM to work the way Twenty does, and Twenty is built on fields that each workspace defines. This change adds custom fields to each project board. It is the first of eight changes. The next ones are a table view, saved views with filters, companies and contacts, a full record page, search with CSV import and export, automations, and email and calendar sync. Each of them reads and writes values through the field registry this change introduces.

## What Changes

- A project board gains its own list of custom lead fields. A field has a name, a type, a place in the list and, for list types, its options.
- Seven field types: Текст, Число, Дата, Список (one option), Несколько из списка (several options), Флажок and Ссылка.
- Members who may manage the board's columns create, rename, reorder and delete fields from a Поля dialog opened from the board header. A board holds at most 30 fields. Deleting a field needs confirmation stating how many leads have a value in it.
- List fields carry 1 to 50 options, each with a name and a color from a fixed palette. Options can be added, renamed, recolored, reordered and removed. Removing an option clears it from every lead in the same transaction.
- A field's type is fixed once the field is created.
- Each lead stores a value for each field. The API validates values against the field's type and refuses unknown fields and wrong types with 400.
- The lead card shows the board's fields, in board order, after Источник and before the description, with an editor that matches each type.
- Field definition changes are audited and reach open boards through the existing realtime notification. Value changes are audited with the lead and appear in the lead's Активность tab under the field's name.
- Deleting a project removes its fields with its leads and columns.

## Capabilities

### New Capabilities
- `lead-custom-fields`: Custom field definitions on a project board, their types and options, how values are stored, validated, edited and shown in the lead card, and how changes are audited and listed in activity.

### Modified Capabilities
- `lead-crm`: The lead card's field order gains the board's custom fields after Источник. The activity list names custom field changes. Deleting a project also removes its custom fields.

## Impact

- Database: new `lead_field` table and a `custom_values` JSONB column on `lead`, with a migration. Existing leads get an empty value set.
- API module `leads`: new domain rules for field definitions and values, repository methods, routes `GET/POST /api/leads/boards/:boardKey/fields` and `PATCH/DELETE /api/leads/boards/:boardKey/fields/:id`, and a `customValues` property on lead create, update and read. OpenAPI docs are updated.
- Web: `entities/lead` gains field types and queries. A new `features/lead-field-management` holds the Поля dialog. `features/lead-management` renders custom field rows in the lead card and in the activity tab. `ru.ts` gains the copy.
- No change to stage counts, Meta import or the dashboard.
