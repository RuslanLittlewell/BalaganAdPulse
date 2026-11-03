## Context

A report stores its computed figures as JSON on `monthly_report.figures` (`spend`, `leads`,
`history`, `ads`) and recomputes them only on generation and refresh. The trend is
`figures.history` plus the report's own month. `computeFigures` starts the history at the later
of the project's first month with campaign metrics and the start of the six-month window, and
takes a month's leads from that month's report correction when one exists. The messenger count
is a nullable integer column, `messenger_contacts`, edited through `PATCH`.

The campaign screens already count results per result type: `MetricRepository.readTypedDays`
turns Meta ad set results into types by optimisation goal and Google category results into
types by category. Reports know nothing of result types today.

Creatives are copied in `createIntegrationUseCases().adCreatives`. `S3CreativeFiles.copy`
returns `null` for every kind of failure and remembers every outcome per URL for the life of the
process, `null` included. `PrismaCreativeStore.save` deletes an ad's creatives and writes the new
ones with `quality = CREATIVE_QUALITY`, whatever was copied. On 2026-10-13 storage writes failed
while the disk filled up, so eight Aurora creatives were saved without files at full quality and
never read again. Those eight rows were set back to `quality = 0` on production on 2026-11-03,
so the current code reads them again on their next view.

## Goals / Non-Goals

**Goals:**
- Count the fourth figure exactly as the campaign screens count the chosen result type.
- Keep the rule that stored figures change only on generation and refresh, with one explicit
  exception: saving trend entries from a report rewrites that report's history.
- Make a failed creative copy recoverable without making a skipped one retry forever.

**Non-Goals:**
- Importing new Meta actions, such as conversations started by campaigns of other objectives.
- Entering figures for the report's own month by hand beyond the existing lead correction.
- Summing several result types into the fourth figure.

## Decisions

### Results per type are stored in the figures JSON

`ReportFigures` gains `results: { type, results }[]`, computed at generation and refresh for
the report's month. `ReportMetrics` gains `resultTotals(projectId, month)`. Its Prisma
implementation reads the project's campaigns and asks the campaigns module's
`MetricRepository.readTypedDays`, injected through the reports wiring, then sums by type with
`sumByType`. Reusing the campaign code keeps one definition of "messages" across the product.
Recomputing on every read was rejected: it would break the stored-figures rule and make a
published report change under the client.

Reports generated before this change have no `results` key. The read path treats it as empty,
so only the hand-entered count is offered until a refresh, as the spec states.

### The choice is a nullable column, null meaning the hand-entered count

`monthly_report.contacts_source` holds a result type or null. `messenger_contacts` keeps the
hand-entered count, so existing reports keep exactly what they show today. The response gains
`contactsSource` and `contacts`, the value readers see: the stored total of the chosen type, 0
when the refreshed figures no longer hold it, or the hand-entered count. Staff also receive
`resultTotals` to build the list. Generation sets the column to `MESSAGES` when the month's
results hold messages. `PATCH` validates the type against the stored figures and answers 400
otherwise.

A type name rather than a free label keeps the label translated in one place, `ru.ts`, and lets
the PDF and the page name the figure the same way.

### Trend entries live in a project table and win over everything else

A new model `ProjectMonthFigure` (`project_month_figure`): `projectId`, `month` (date, first
day), `leads` (int), `spend` (decimal, nullable), `updatedAt`, unique on `(projectId, month)`,
cascading with the project. It sits in `reports.prisma`, owned by the reports module.

`computeFigures` receives the entries for the window. For each history month: leads come from
the entry, else the report correction, else the synced count; spend comes from the entry, else
the synced spend. The history starts at the earliest of the first synced month and the earliest
entry, bounded by the six-month window. A month before the first synced month with no entered
spend has spend `null`, so its cost per lead is absent instead of a misleading zero.
`MonthTotals.spend` in history therefore becomes `string | null`; the report's own month keeps a
string.

Entries beat a report correction because they are the latest explicit statement about that
month, made where the trend is edited. Storing entries on the report was rejected: the next
month's report would lose them.

### One endpoint sets or clears the entries of a report's window

`PUT /api/projects/:projectId/reports/:reportId/history` takes
`{ months: { month, leads | null, spend | null }[] }` for the five months before the report's
month. In one transaction it upserts each listed month, deletes a listed month whose leads are
null, leaves unlisted months alone, writes this report's `figures.history` recomputed from the
current data and the new entries, and appends an audit event. The editor sends all five rows, so
an emptied row clears its month. Spend, leads and ads of the report are left alone, so the edit does not
act as a hidden refresh. Other reports pick the entries up when generated or refreshed.
Staff responses gain `history`, the entries in the window, so the editor knows which months are
entered.

A per-month `PUT`/`DELETE` pair was considered; one call matches the editor, which saves the
five rows at once, and keeps the recompute to one write. Deleting unlisted months was rejected
so that a client sending a partial list cannot wipe entries it did not mention.

### A failed copy throws; a skipped copy returns null

`CreativeFiles.copy` keeps returning `null` when it skips a file by rule (bad address, wrong
content type, over the size limit) and now throws when downloading or writing fails. It
remembers only successes and skips, so a retry within the same process reaches the provider
and storage again. The use case copies each file in its own `try`, and marks a creative
complete when no copy threw. `StoredCreative` gains `complete`. When a copy failed and the ad
already has stored creatives, which can only be outdated ones since complete ones are never
read again, the use case keeps them untouched and returns them; they stay outdated, so the next
view tries again. When nothing was stored yet, it saves what it has, and
`PrismaCreativeStore.save` writes `quality = 0` for incomplete creatives so `outdated` sends the
next view to the provider.

Carrying earlier file keys over to the new rows by external id and position was tried first and
dropped: the provider may give the same picture a new creative id, and the match then loses the
earlier copy, which is the case the existing "keeps the earlier copies" test covers.

## Risks / Trade-offs

- [An image that fails for a lasting reason the copier does not recognise, such as a
  provider URL answering 403 for good, is read again on every view] → each read is one provider
  call per view, already deduplicated per ad while it runs; acceptable for the handful of ads
  affected.
- [Entries change the trend of other reports only on refresh, so two reports can show different
  figures for the same month for a while] → the editor saves from the report being prepared,
  which updates at once; staff refresh older drafts when needed, as they do for synced data.
- [`contacts` of a published report can change when staff refresh it] → the same holds for every
  computed figure today.

## Migration Plan

One Prisma migration: `CREATE TABLE project_month_figure` with its unique index and foreign key,
and `ALTER TABLE monthly_report ADD COLUMN contacts_source TEXT`. No backfill. Existing reports
keep their hand-entered count and show the result types after a refresh. The `api` container
applies the migration on start; after pulling, restart it so it regenerates the client.
Rollback: drop the column and the table; entered months are lost, nothing else is.
