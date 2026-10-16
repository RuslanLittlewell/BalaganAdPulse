## 1. Fields: amount, service, site type, Telegram, messenger, tags

- [x] 1.1 Add failing API tests: round trip of the new fields; amount as a four-decimal string,
  refused when negative or malformed; tags trimmed, limited to 10 of 30 characters, refused
  when duplicated regardless of case; a minimal lead has no amount and no tags.
- [x] 1.2 Add the columns to `schema.prisma` and a migration; extend the lead domain, schemas,
  repository mapping (decimal to string) and OpenAPI; run `npm test` until green.

## 2. Files

- [x] 2.1 Add failing API tests: upload, list, download as an attachment under a UTF-8 name,
  delete; 20 MB limit; guests list and download but cannot upload or delete; 404 across boards;
  files gone with their lead; file events audited on the lead.
- [x] 2.2 Add `lead_file` to the schema and migration; implement the storage port, repository,
  use cases, multer route and OpenAPI; remove S3 objects when a lead is deleted; run
  `npm test` until green.

## 3. Activity

- [x] 3.1 Add failing API tests: creation, a field change with before and after, a stage move
  named by stage, file added and removed, an imported lead's arrival, newest first, updates that
  change nothing tracked left out, 404 across boards.
- [x] 3.2 Implement the activity read model and route; run `npm test` until green.

## 4. The two-column card

- [x] 4.1 Rewrite the lead dialog tests for the card: field rows in order, Создать and Сохранить,
  the amount with the project currency, tags with board suggestions, the Активность and Файлы
  tabs only, disabled until the lead exists, uploading and listing files, the activity entries
  in Russian, read-only for guests, the imported source section. Run them and see them fail.
- [x] 4.2 Build `LeadCard` and its tabs, add the lead file and activity queries and the strings
  in `ru.ts`, and switch `CrmPage` to it; refresh files and activity on CRM realtime events.
- [x] 4.3 Run `npm run test:web` until green.

## 5. Card revisions

- [x] 5.1 Update the tests: no site type in the API tests; in the card tests, creating shows no
  right column, no Вид сайта or Кампания row, no currency sign on the amount, and a
  Доп. информация tab holding the Meta source only for an imported lead. Run them and see them fail.
- [x] 5.2 Drop `site_type` from the schema, the migration and the API; rework `LeadCard` to match;
  run `npm test` and `npm run test:web` until green.

## 6. Close the change

- [x] 6.1 Run `npm test`, `npm run test:web` and both builds until green.
- [x] 6.2 Run `openspec validate lead-card-two-columns --strict`.
