## 1. API

- [x] 1.1 Add the `lead-import` resource to the access policy for `ADMIN` and `CLIENT_ADMIN`, and the lead origin `IMPORT` with its migration
- [x] 1.2 Parse CSV text with separator detection, quotes, line breaks in values and a byte order mark; read a Google Sheet link through the export address the server builds; refuse other links, closed sheets, empty tables, over 5000 rows and over 10 MB
- [x] 1.3 Plan an import: read submission dates, find campaigns by IDs inside the value and then by name, apply the member's choices, skip rows already on the board, repeated in the table or without contact, and count each outcome
- [x] 1.4 Write an import in one transaction: claims, contacts, leads in the first column with the origin `IMPORT`, their sources and dates, the realtime announcement and one audit entry
- [x] 1.5 Serve `POST /api/crm/boards/:boardKey/imports/table`, `/imports/preview` and `/imports` with their own body limit, schemas and OpenAPI entries
- [x] 1.6 Cover the parser, the sheet reader, the planner and the three endpoints with tests: roles, reach, Gealan's ID forms, manual choices, duplicates, a repeated import, partner visibility and the arrival date
- [x] 1.7 Place leads by status: match the board's own columns and the fixed stages by key and name, accept picked columns for unmatched statuses, group the preview by status, and put imported leads on top of each target column
- [x] 1.8 Cover placement by status with tests: a qualified row, a board's own column, a picked column, a column outside the board and the positions in each column

## 2. Web

- [x] 2.1 Propose column roles from column names and decode files as UTF-8 with a Windows-1251 fallback
- [x] 2.2 Add the import dialog: a file or a sheet link, the column roles, the preview with counts and campaign choices, and the result; open it from a button on the CRM board for admins and client admins
- [x] 2.3 Show the origin «Импорт» and the imported details on the lead card, with Russian and English copy
- [x] 2.4 Cover the role proposal, the decoding and the dialog with tests
- [x] 2.5 Propose the status role and show every status in the preview with a column picker set to the column found or the first column
- [x] 2.6 Cover the status role and the column picks with tests

## 3. Close

- [x] 3.1 Run `npm test`, the web tests and the type-checks until green; `openspec validate lead-import --strict`
- [ ] 3.2 After deployment, import the Gealan sheet: the preview should add 32 leads, skip 75 already in the CRM and 3 repeats, link 31 to the Connecticut campaign, list one value for a manual choice and place the `Qualified` row in «Квалифицированный»
