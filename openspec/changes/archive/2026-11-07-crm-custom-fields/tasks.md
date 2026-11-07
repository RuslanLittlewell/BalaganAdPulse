## 1. Data and domain

- [x] 1.1 Add the `LeadFieldType` enum, the `LeadField` model and `Lead.customValues` to the Prisma schema, with an additive migration
- [x] 1.2 Add `leads/domain/lead-field.ts`: types, palette, limits, `BUILT_IN_FIELD_NAMES`, name and option rules, value normalization per type and `applyCustomValues`
- [x] 1.3 Cover `lead-field.ts` with domain tests: every type's valid and invalid values, empties, canonical numbers, real dates, option identity, unknown ids, name rules and limits

## 2. API

- [x] 2.1 Move the board `mutation` helper into `application/board-mutation.ts` and use it from the lead and column use cases with no behavior change
- [x] 2.2 Add `LeadFieldRepository` and its Prisma adapter, and read and write `customValues` in `PrismaLeadRepository`
- [x] 2.3 Add `createLeadFieldUseCases`: list, create, update (name, options, position) and delete, with value cleanup for removed fields and options, audit and `crm.changed`
- [x] 2.4 Apply `applyCustomValues` in lead create and update inside the board lock
- [x] 2.5 Add the field routes and `customValues` to the lead schemas, wire them in the composition, and document them in the OpenAPI document
- [x] 2.6 Extend `buildActivity` with custom field changes resolved through the board's current fields
- [x] 2.7 API tests: field CRUD with permissions (guest 403, other board 404), name uniqueness and built-in names, the 30-field limit, fixed type, option edits keeping identity and removals clearing values, delete clearing values, order under create, move and delete, lead create and partial update with values, values of another board's field refused, Meta import with no values, audit events, project deletion removing fields, and the migration giving existing leads an empty set
- [x] 2.8 Activity tests: custom change named by the field, option names, a removed option, a deleted field skipped

## 3. Web

- [x] 3.1 Add `LeadField` and `CustomValue` types, the fields query and mutations to `entities/lead`, and invalidate the fields key in `useCrmEvents`
- [x] 3.2 Build `features/lead-field-management`: `LeadFieldsButton` and `LeadFieldsDialog` with the list, add and edit form, option editor with colors, move up and down, and delete confirmation with the lead count. Render the button in `CrmPage` for members who may create leads
- [x] 3.3 Render custom field rows in `LeadCard` after Источник with an editor per type, send only changed custom values, and show API refusals beside the form
- [x] 3.4 Format custom field changes in `LeadActivityTab`
- [x] 3.5 Add the Russian copy to `ru.ts` and the default handlers for the fields endpoint in the test MSW setup
- [x] 3.6 Web tests: the Поля dialog adds, edits, moves and deletes fields with the count in the confirmation, keeps values on a refusal, and is hidden from guests; the lead card shows rows in order with each editor, saves only changed values, shows read-only values and an openable link to guests, and keeps the card open on an invalid value; activity shows custom changes and removed options

## 4. Docs

- [x] 4.1 Describe custom fields in the README's CRM section
