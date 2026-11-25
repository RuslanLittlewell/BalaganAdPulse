## Why

Leads that reached a client before the CRM started collecting them live in spreadsheets. Gealan
keeps 110 leads from its Meta lead forms and its Marquiz quiz in a Google Sheet, and 35 of them
are not on the board: the lead forms from before the Meta integration started, and the quiz
submissions. A partner sees only the leads of their campaign, so a lead added by hand without a
campaign stays out of the partner's sight. The CRM needs a way to bring such a table in, each
lead on its project's board and linked to its campaign.

## What Changes

- An admin or a client admin can import leads into a project's board from a CSV file or from a
  Google Sheet shared by link.
- The import reads the table's columns and proposes what each one holds: the name, phone,
  email, submission date, campaign, UTM tags, page, referrer, or the answer to a question.
  Technical columns are skipped. The person importing can change any column's role before
  the import.
- Each lead is linked to a campaign of the project by a campaign, ad set or ad ID found in its
  campaign column, or by the campaign's exact name. A value that matches no campaign is listed
  before the import, and the person importing picks a campaign for it or leaves those leads
  without one.
- A row whose phone or email already belongs to a lead on the board, a row repeated within the
  table, and a row with no name, phone or email are skipped. The preview shows how many leads
  will be added and how many will be skipped, and why.
- A status column places each lead in the board column it names, such as `Qualified` in
  «Квалифицированный» or a board's own column by its name. A status that names no column is
  listed before the import, and the person importing picks a column for it or leaves its leads in
  the first column.
- Imported leads keep their submission date, UTM tags and answers, and show the origin «Импорт»
  on their card. A lead without a status lands in the board's first column.

## Capabilities

### New Capabilities

- `lead-import`: importing leads into a project's CRM board from a CSV file or a Google Sheet,
  with column roles, campaign linking, placement by status, duplicate skipping and a preview.

### Modified Capabilities

None.

## Impact

- API: `POST /api/crm/boards/:boardKey/imports/table`, `/imports/preview` and `/imports`; a CSV
  parser; a Google Sheets reader; the import use cases and their repository; OpenAPI.
- Access policy: a `lead-import` resource that only `ADMIN` and `CLIENT_ADMIN` may create.
- Prisma: the lead origin `IMPORT`. Imported leads keep their details in the existing website
  source table.
- Web: an import button and dialog on the CRM board, the origin «Импорт» on the lead card,
  Russian and English copy.
- No new dependency.
