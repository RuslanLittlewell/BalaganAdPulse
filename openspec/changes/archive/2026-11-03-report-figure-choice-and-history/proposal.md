## Why

Three problems came up with monthly reports. Staff type the fourth headline figure, contacts
through messengers and social networks, by hand, although Meta already reports the
conversations that ads started. The leads trend starts at the first month the system has
figures, so a client connected last month gets a trend of one or two points and no visible
dynamics. And some best-ad cards in reports lost their pictures: creatives copied while the
production disk was full on 2026-10-13 were saved without files and marked as final, so they
are never fetched again.

## What Changes

- The fourth headline figure of a report becomes a choice. Staff pick either a result type the
  project recorded in the report's month, such as messages, profile visits or calls, and the
  report shows that type's total from the synced data, or a figure entered by hand, which keeps
  today's label and behaviour. A new report starts on messages when the month has any.
- Generating or refreshing a report also stores the month's results per result type, so the
  fourth figure follows the same "stored until refreshed" rule as the other figures.
- Staff can enter leads, and optionally spend, for the months before the report's month that
  fall in its trend. The entries belong to the project, take precedence over synced and
  corrected figures for their month, and let the trend start before the first month the system
  has figures. The report they are entered from shows them at once; other reports pick them up
  when generated or refreshed.
- **BREAKING** for API clients: `spend` of a trend month and of `previous` may now be `null`, for
  a month before the project's figures that was entered without spend. The web app is updated in
  the same change.
- The PDF summary states the chosen figure with its label.
- A creative whose file failed to copy is no longer saved as final. The next view reads it from
  the provider again, and a file copied earlier for the same creative is kept in the meantime.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `monthly-reports`: the computed figures gain per-type results and an earlier trend start;
  the hand-filled messenger count becomes a chosen fourth figure; staff enter past months for
  the trend; the PDF summary states the chosen figure.
- `ad-creatives`: a creative whose file failed to copy is read again on its next view and keeps
  an earlier copy until then.

## Impact

- Database: a new `project_month_figure` table and a nullable `contacts_source` column on
  `monthly_report`. Existing data survives; existing reports keep the hand-entered figure.
- API: `PATCH /api/projects/:projectId/reports/:reportId` accepts `contactsSource`; a new
  `PUT /api/projects/:projectId/reports/:reportId/history` sets or clears the hand-entered months
  of the report's trend; report responses gain `contactsSource` and `contacts`, and staff also get the entered
  `history` and `resultTotals`, which is null for a report stored before results per type.
- Backend: the reports module (domain, use cases, repository, metrics), the creative store and
  the creative refresh in the integrations module, the composition wiring.
- Web: the report page (fourth figure, trend history editor), the report entity API and the PDF
  summary slide.
