## Context

A KPI is stored on its owner's row: `kpi_metric` (the `kpi_metric` enum), `kpi_target`
and `kpi_updated_at`, on `organization`, `project` and `campaign` alike. `modules/kpi`
reads and writes those columns through one repository, validates `{ metric, target }`
with a strict Zod schema and audits every change. On the web, `kpiProgress(figures, kpi,
range)` in `entities/kpi` turns a KPI into a percentage and a state, and the KPI tile,
`campaignTone` and `projectTone` all go through it. The projects summary returns each
project's `{ metric, target }`.

## Goals / Non-Goals

**Goals:**
- A project goal the platform does not measure can be tracked with the same tile, marker
  and zones as a measured one.
- One KPI per project still: the manual kind is another shape of the same slot.

**Non-Goals:**
- Manual KPIs on the organization or on campaigns.
- A history of manual values or lower-is-better manual goals.

## Decisions

**`MANUAL` is a value of the metric enum.** The discriminator stays the one column every
reader already looks at, so "one KPI per project" and "setting replaces" need no new rule,
and clearing still nulls the same columns. Only `project` gains `kpi_name` (text) and
`kpi_value` (`Decimal(18,4)`), written for a manual KPI and nulled otherwise. A separate
manual-KPI table was rejected: it would let a project hold two KPIs and every reader would
have to choose between them.

**The API input is a discriminated union.** `kpiInputSchema` becomes
`{ metric: <measured>, target }` or `{ metric: "MANUAL", name, value, target }`, both
strict. The value accepts zero; the target stays positive. The use case refuses `MANUAL`
for any level but a project with a validation error (400), before reading or writing
anything. The response and the audit snapshot carry `name` and `value` only for a manual KPI.

**Progress is computed where it already is.** `kpiProgress` returns `value / target` for a
manual KPI and ignores the figures and the range, so the tile and the project marker pick
it up without code of their own. Its state is met, exceeded or behind by comparing value
and target; it is never unmeasured since the target is positive. `kpiInputOf(raw)` in
`entities/kpi` turns the loosely typed KPI the projects summary and campaigns carry into a
`KpiInput`, or null for a metric it does not know, and both tone functions use it.

**A manual project KPI does not stand in for campaigns.** `campaignTone` falls back to the
project's KPI only when it is a measured one: comparing every campaign with the project's
hand-entered value would paint them all the project's colour.

**The tile names the goal by its name.** A manual KPI has no metric definition; the tile
heads it `KPI · <name>` and formats value and target as plain numbers with up to four
decimals, through a new `formatNumber` in `shared/lib/metrics.ts` and a `"number"` KPI format.

## Migration Plan

One migration adds `MANUAL` to the `kpi_metric` enum and the nullable `kpi_name` and
`kpi_value` columns to `project`, with check constraints in the spirit of the existing
`*_kpi_complete` ones: a project holds a name and a value exactly when its metric is
`MANUAL`, and the organization and campaigns never hold `MANUAL`. Nothing is backfilled:
every existing KPI is a measured one and satisfies them. The constraints compare
`kpi_metric::text`, so the new enum value is never used as such inside the migration that
adds it. Rolling back means clearing manual KPIs first
(`UPDATE project SET kpi_metric = NULL, kpi_target = NULL, kpi_updated_at = NULL WHERE
kpi_metric = 'MANUAL'`) and dropping the two columns; Postgres cannot drop an enum value, so
`MANUAL` would stay in the type unused.

## Risks / Trade-offs

- A manual value goes stale when nobody updates it → the dialog says it changes only by
  hand; the tile's `updatedAt` is already returned for a later "updated on" line.
- An old web tab reading a manual KPI it does not know would find no metric definition →
  the tile and both tones treat an unknown metric as no KPI rather than failing.
