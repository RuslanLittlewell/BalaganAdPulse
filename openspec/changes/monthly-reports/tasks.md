## 1. Store and generate reports

- [x] 1.1 Add the `report` resource to `packages/access-policy` (read: everyone; create, update, delete: ADMIN, MANAGER); extend its tests.
- [x] 1.2 Migrate `monthly_report`, `monthly_report_ad` and `report_status`; regenerate Prisma.
- [x] 1.3 Implement the month-ended rule across connection timezones and the figure computation: spend, leads, previous month, six-month trend using earlier reports' corrections, suggested top three ads.
- [x] 1.4 Implement the `reports` module routes: list, generate (400 for an unfinished month, 409 for a duplicate), read, delete, refresh; drafts hidden from those who cannot update; audit events.
- [x] 1.5 Add API tests: generation figures, month-ended boundary in a non-UTC timezone, duplicate 409, snapshot kept after a sync rewrite, refresh keeps hand-entered parts, reach 404, customer 403.

## 2. Correct, complete and publish

- [x] 2.1 Implement `PATCH` for leads override, messenger contacts, conclusions, plan and chosen ads (validated against the month's spend, at most six); derive cost per lead and changes on read; publish and unpublish.
- [x] 2.2 Add API tests: override changes cost per lead and change, clearing it, chosen ad without spend 400, order kept, draft invisible to client and guest, published visible.
- [x] 2.3 Run `npm test` until green.

## 3. Report view and editing

- [x] 3.1 Add the reports API to the entities layer and the Russian copy to `ru.ts`.
- [x] 3.2 Build the `monthly-report` widget: headline figures with messenger contacts, leads and cost-per-lead trends, best-ad cards with creatives, conclusions and plan.
- [x] 3.3 Add staff editing in place: leads correction showing the computed count, messenger contacts, the ad picker with reordering, the rich text editors, refresh, publish, unpublish and delete.
- [x] 3.4 Add web tests: a client sees no editing controls, correcting leads updates cost per lead, ad picker add, remove and reorder, publish toggles status.

## 4. Reports across projects

- [x] 4.1 Add `GET /api/reports` (reachable projects, optional `projectId`, newest month first, drafts only for staff) and `GET /api/reports/:id`; replace `next` with `available` (up to twelve most recent ended months without a report) in the project list; update the OpenAPI document.
- [x] 4.2 Add API tests: the list spans reachable projects only, the filter, drafts hidden from customers, read by id with reach 404, `available` skips months with a report and unfinished months, empty for customers.

## 5. The Reports module

- [x] 5.1 Remove the reports section from the project page and the report route from the projects router; delete the `project-reports` widget and its tests.
- [x] 5.2 Show Reports in the main navigation to every role; replace the placeholder with `pages/reports`: the list across projects with a project filter and status for staff.
- [x] 5.3 Add the «Новый отчёт» dialog for staff: choose a project, then a month from `available`; creating opens the report.
- [x] 5.4 Open a report at `/reports/:reportId` with `widgets/monthly-report`; deleting returns to the module.
- [x] 5.5 Add web tests: navigation shows Reports to a client, the list and filter, no create control for a client, creating offers only available months and opens the report, the project page shows no reports.

## 6. PDF download

- [x] 6.1 Add `@react-pdf/renderer` and the vendored Inter and Oswald fonts (Latin and Cyrillic merged per weight); build the pure slide model from a report, its project and client.
- [x] 6.2 Build the slide template: cover, month summary, trends drawn with `Svg`, ad slides, conclusions and plan from Tiptap documents; register the fonts afresh for every PDF.
- [x] 6.3 Load each best ad's picture (a video's poster) through the creative routes and convert it to PNG on a canvas.
- [x] 6.4 Add «Скачать PDF» to the report view for every reader, loading the renderer on demand, showing progress and saving «Отчет <client> _ <Month> <year>.pdf».
- [x] 6.5 Add tests: the slide model (order, optional slides, corrected leads, file name), Tiptap conversion, the download button saves a PDF.
- [x] 6.6 Run `npm test` and `npm run test:web` until green; `openspec validate monthly-reports --strict`.

## 7. Cover, logo and creative quality

- [x] 7.1 Migrate `monthly_report.cover_key`, `cover_content_type` and `ad_creative.quality`; add the cover routes (upload, read, remove) and `hasCover`; API tests for upload, type and size refusal, reach and customer 403.
- [x] 7.2 Read the largest video thumbnail as the poster and resolve `image_hash` originals for link and carousel images; refresh creatives stored under quality 0 on their next view, keeping them when the provider does not answer; tests.
- [x] 7.3 Show the cover as a banner in the report view with upload, replace and remove for staff; web tests.
- [x] 7.4 Draw the agency logo on the PDF cover, use the cover picture before the first ad's, fit dark-panel titles; tests for the deck model.
- [x] 7.5 Run `npm test` and `npm run test:web` until green; `openspec validate monthly-reports --strict`.
- [x] 7.6 Turn the cover block into a dropzone for staff (drop or click to choose, keyboard reachable, drag state exposed) beside the stacked headline figures; web tests.
