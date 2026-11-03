## Context

The Meta sync writes `campaign_daily_metric`, `ad_set_daily_metric` and `ad_daily_metric`
rows keyed by the account-local date; `conversions` carries the Meta `lead` action. A sync
may rewrite past days. Ads carry their creatives in `ad_creative`, whose files are fetched on
first look and served through the existing creative routes, which already follow the ad's
reach. Project reach comes from `ClientAccess` grants and the `access-policy` matrix. Task
descriptions are Tiptap JSON, edited with the shared rich text editor.

## Goals / Non-Goals

**Goals:**
- One stored, correctable report per project and finished month, readable by the client.
- A Reports module that lists, creates and shows reports, and downloads them as PDF slides.

**Non-Goals:**
- Server-side PDF rendering, sending reports by e-mail, notifying the client on publish.
- Reports spanning several projects or a whole client.
- Syncing messenger contacts from Meta; the count is entered by hand.
- Overriding spend or any figure other than leads.

## Decisions

- **Store a computed snapshot, not live queries.** `monthly_report` keeps the computed
  figures in a `figures` JSONB column (spend, computed leads, previous month, trend points,
  suggested ads with their month's leads and spend) stamped with `computed_at`. Live
  computation would change a published report whenever Meta rewrites a day, which is the
  inconsistency the feature removes. Refresh is an explicit action that rewrites `figures`
  only. Alternative — normalized columns per figure: rejected, the trend and ads are lists
  and nothing queries inside them.
- **Hand-entered parts are columns.** `leads_override INT NULL`, `messenger_contacts INT
  NULL`, `conclusions JSONB NULL`, `plan JSONB NULL` (Tiptap documents), `status`
  (`DRAFT` | `PUBLISHED`), `published_at`, `created_by_id`. Chosen ads live in
  `monthly_report_ad (report_id, ad_id, position)`, seeded from the suggested top three on
  generation; deleting an ad cascades out of the selection.
- **Derived values are computed on read.** Effective leads = override ?? computed; cost per
  lead and changes are derived from effective values when the API serializes a report, so a
  correction never leaves stale derived numbers. Money crosses the API as four-decimal
  strings; changes as decimal fractions (`"0.3768"`).
- **Earlier corrections feed later trends at generation time.** When computing the trend and
  previous month, a month that has a report with `leads_override` uses it. A correction made
  after a later report was generated shows there on that report's next refresh.
- **Month identity.** `month DATE` holding the first day of the month, `UNIQUE (project_id,
  month)`. The month has ended when, for every connection's `timezone`, the local date is on
  or after the first of the next month; with no connection, UTC. Daily rows are matched by
  their stored date between the first and last day of the month.
- **Every ad that spent is part of the snapshot.** `figures.ads` holds each ad with spend in
  the month (id, name, spend, leads). Staff choose among them, the update refuses any other
  id, and chosen ads show their stored figures, so they never drift from the headline numbers.
  A refresh drops chosen ads that no longer spent.
- **Creatives are not embedded.** A report lists ad ids; the web app reads their creatives
  through the existing `GET /api/ads/:id/creatives`, which already follows the ad's reach and
  fetches files on first look.
- **A `reports` module** in `apps/api/src/modules/reports` with the usual domain /
  application / infrastructure / presentation layers. Routes:
  `GET /projects/:projectId/reports`, `POST /projects/:projectId/reports` (`{ month:
  "2026-08" }`), `PATCH|DELETE /projects/:projectId/reports/:reportId`,
  `POST …/:reportId/refresh`, `POST …/:reportId/publish`, `POST …/:reportId/unpublish`.
  Across projects: `GET /reports?projectId=` lists reports of every reachable project with
  their `projectId`, and `GET /reports/:id` is the one way to read a report; actions keep
  the project-scoped paths, and naming a report under a project it does not belong to
  answers 404. The project list answers `available`: up to twelve most
  recent ended months without a report, newest first, empty for those who cannot create.
  Reach goes through the project repository; drafts answer 404 when `can(actor, "update",
  "report")` is false. Mutations write audit events in their transaction.
- **Web: the Reports module.** `ROUTES.reports` renders `pages/reports`: a list across
  projects (project, month, spend, leads, status for staff) with a project filter, and a
  «Новый отчёт» dialog for staff choosing a project, then a month from `available`. The report
  opens at `/reports/:reportId` and renders `widgets/monthly-report`: summary tiles, two
  monthly line charts on the SVG approach of `campaign-overview/DailyChart` (no chart library),
  best-ad cards reading `useAdCreatives`, and the two rich text blocks. Staff edit in place.
  The main navigation drops `agencyOnly` from Reports. The project page has no reports
  section and the projects router no report route.
- **PDF in the browser with `@react-pdf/renderer`.** Alternatives: server-side headless
  Chrome (rejected: Chromium in the Render image and server load) and `html2canvas` + `jsPDF`
  (rejected: raster text, large files). The renderer and the template are imported
  dynamically when «Скачать PDF» is clicked, so the main bundle does not grow.
- **The template copies the agency's AURORA report.** 16:9 pages (960×540 pt): a cover with a
  white left half (the «Balagan» wordmark, the title in Oswald bold uppercase, «за <месяц>»
  beside a rule) and a picture on the right; section slides with a black left third holding
  the title in white Oswald and the content in Inter on white; the trends slide titled in
  Oswald with two line charts drawn with react-pdf `Svg`; ad slides with the picture on the
  left and a light grey «Результат:» panel.
- **One font file per weight, vendored.** Inter (400, 400 italic, 700, 700 italic) and Oswald
  (400, 700) live in `features/report-pdf/fonts` with their OFL licences. Each file merges
  the Latin and Cyrillic subsets published by Fontsource. Alternative — registering the two
  subsets as a fallback chain: rejected, react-pdf breaks lines wrongly where a run switches
  files (a period after Cyrillic moves to the next line and leaves a missing glyph).
- **Fonts are registered afresh for every PDF.** react-pdf keeps glyph state on a loaded font
  between documents, and a second, different document then loses glyphs. Each build
  registers the families under new names, so every PDF starts from freshly loaded fonts.
- **Pictures go through a canvas.** react-pdf reads only JPEG and PNG; each best ad's file (a
  video's poster) is fetched through the creative routes, drawn on a canvas and handed over
  as a PNG data URL, which also covers WebP. A picture that fails to load leaves its slide
  with the grey panel alone.
- **Tiptap to PDF.** Paragraphs, bold and italic marks, bullet and ordered lists and hard
  breaks map to react-pdf `Text` and `View`; other nodes fall back to their text.
- **The slide model is pure.** A function turns a report, its project and client into the
  ordered list of slides; the components only draw it. Tests cover the model and the
  download, not the drawing.

- **Cover picture.** `monthly_report.cover_key` and `cover_content_type` point at an object
  `reports/<id>/cover` in the existing S3 storage. `PUT …/:reportId/cover` (multipart `image`,
  JPEG/PNG/WebP checked by signature, 10 MB) and `DELETE …/:reportId/cover` are staff-only;
  `GET …/:reportId/cover` serves it to readers of the report. The report answers `hasCover`.
  The web view opens with a two-column grid: the headline figures stacked on the left, the
  cover — or, for staff, a dropzone placeholder — on the right; with neither, the figures run
  in one row; the PDF cover loads it like a creative
  (canvas to PNG) and falls back to the first best ad's picture.
- **The logo** is the agency's SVG drawn with react-pdf `Svg` and `Path` on the cover.
- **Panel titles fit.** The type size of a dark-panel title is the smaller of 50 pt and what
  lets its longest word fit the panel's inner width at Oswald Bold's widest letter ratio.
- **Creatives in best quality.** Video lookups ask for `thumbnails{uri,width,height}` and take
  the widest as the poster; `link_data` and carousel frames pass their `image_hash` to the
  existing `adimages` original lookup. `ad_creative.quality` (default 0) records the rule a
  copy was made under; the current rule is 1. Opening an ad whose stored creatives are below it
  reads the provider again and replaces them when it answers with creatives; otherwise the old
  copies stay.

## Risks / Trade-offs

- [Meta attributes late leads after the month closes] → staff refresh the report before
  publishing; the `computed_at` stamp is shown to staff.
- [Creative files not yet fetched] → the existing creatives route fetches them on first look.
- [Generating the PDF takes seconds and a few hundred KB of code] → loaded on demand; the
  button shows progress and stays disabled until the file is saved.
- [Projects in several currencies over time] → figures are stored with the project's
  currency at generation; a report keeps its own.

## Migration Plan

One Prisma migration adding `monthly_report`, `monthly_report_ad` and the `report_status`
enum, and a second adding `monthly_report.cover_key`, `cover_content_type` and
`ad_creative.quality` (default 0, so every existing copy is refreshed once on its next view).
Existing data survives; rollback drops the new columns and tables.
