## 1. Creative copies that fail are retried

- [x] 1.1 Make `S3CreativeFiles.copy` throw when downloading or writing fails, return `null` only for skips by rule, and remember only successes and skips
- [x] 1.2 Copy each creative file in its own attempt in `adCreatives`, mark `StoredCreative.complete`, keep an ad's stored creatives untouched when a copy fails, and have `PrismaCreativeStore.save` write `quality = 0` for incomplete creatives
- [x] 1.3 Cover a failed storage write, a kept earlier copy, a retry that succeeds and an oversized file that is not retried in the integration tests; run `npm test`

## 2. Schema

- [x] 2.1 Add `ProjectMonthFigure` to `reports.prisma`, `contactsSource` to `MonthlyReport`, and the migration; restart the `api` container so it regenerates the client

## 3. Results per type and the fourth figure

- [x] 3.1 Add `results` to `ReportFigures`, `resultTotals` to `ReportMetrics` backed by the campaigns `MetricRepository`, and wire it in `reports-kpi.ts`
- [x] 3.2 Add `contactsSource` to the record, repository, edit schema and use cases: default to messages on generation, validate the type on edit, expose `contactsSource`, `contacts` and staff-only `resultTotals`
- [x] 3.3 Cover per-type totals, the default, choosing a type, the 400 for a missing type, a report without stored results and the client view in the domain and API tests; run `npm test`

## 4. Trend entries

- [x] 4.1 Read the project's entries in `figuresFor`, apply entry > correction > synced in `computeFigures`, start the history at the earliest entry or synced month, and allow `null` spend in history
- [x] 4.2 Add `PUT /projects/:projectId/reports/:reportId/history` with its schema, OpenAPI entry, window validation, transactional set or clear, history recompute and audit; expose staff-only `history`
- [x] 4.3 Cover months before the first synced month, an entry over synced leads and a correction, clearing, refresh picking up entries, out-of-window and invalid values, and reader access in the domain and API tests; run `npm test`

## 5. Web

- [x] 5.1 Extend the report entity types and API with `contactsSource`, `contacts`, `resultTotals`, `history`, nullable history spend and a history mutation
- [x] 5.2 Show the fourth figure from `contacts` with a staff-only choice of source, keeping the hand-entered editor for the manual source
- [x] 5.3 Add a staff-only editor under the trend for the five months before the report's month, with leads and spend inputs that show the current value as a placeholder
- [x] 5.4 State the chosen figure on the PDF summary slide
- [x] 5.5 Add the Russian copy to `ru.ts`
- [x] 5.6 Cover the choice, the readers' view, the history editor and the PDF summary line in web tests; run `npm run test:web` and `npm test`
