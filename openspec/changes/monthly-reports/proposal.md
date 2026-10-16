## Why

Every month the agency hand-builds a report per project in slides: spend, leads, cost per
lead, the trend over recent months, the best creatives, conclusions and a plan. Most of those
figures already sit in the synced Meta metrics, yet they are copied by hand and come out
inconsistent (a cost per lead that does not equal spend over leads, a month-over-month change
rounded the wrong way). The client also has no place in the product to read them.

## What Changes

- A project gets monthly reports: at most one per calendar month, available for generation
  once that month has fully ended (the August report from 1 September).
- Generating a report computes its figures from the project's synced data and stores them:
  spend, leads (the Meta `lead` action), cost per lead, the change against the previous
  month, a trend of up to six months, and the best ads of the month with their creatives.
- Staff correct the lead count by hand; cost per lead, the change and later reports' trends
  follow the corrected count. Staff add messenger contacts, conclusions, next month's plan and
  choose which ads to show.
- A report is a draft until published. Admins and managers who reach the project create,
  edit, refresh, publish, unpublish and delete reports; everyone who reaches the project reads
  published reports, the client's people included.
- Reports live in the Reports module, now shown to every role: a list across projects with a
  project filter, creation by project and month, and the report view with editing for staff.
  The project page shows no reports.
- Every reader downloads a report as a PDF of 16:9 slides following the agency's existing
  report template (cover with the agency logo and a cover picture staff upload, month summary,
  trends, best creatives, conclusions, plan).
- Ad creatives are stored in the best quality Meta offers (original images, the largest video
  frame); copies made earlier are refreshed once on their next view.

## Capabilities

### New Capabilities
- `monthly-reports`: generating, correcting, publishing, reading and downloading as PDF a
  project's monthly advertising report, in the Reports module.

### Modified Capabilities
- `access-control`: a `report` resource in the shared permission matrix.
- `ad-creatives`: creatives are copied in the best quality the provider offers, and copies made
  before are refreshed once.

## Impact

- Prisma: new `monthly_report` and `monthly_report_ad` tables; existing data untouched.
- API: a new `reports` module with routes under `/api/projects/:projectId/reports` and
  `/api/reports`; reads campaign and ad daily metrics.
- `packages/access-policy`: the `report` resource.
- Web: the Reports module page, the report view and its editor, the PDF template; the main
  navigation shows Reports to every role; Russian copy in `ru.ts`.
- Dependencies (web): `@react-pdf/renderer`; Inter and Oswald font files (OFL) vendored with
  the PDF feature.
