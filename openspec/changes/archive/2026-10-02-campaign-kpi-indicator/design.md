## Context

`performanceTone` colours a row from ROAS alone. KPI progress is already computed for the
KPI tiles by `kpiProgress` (entities/kpi), which handles monthly targets prorated over the
range and lower-is-better metrics. A campaign's KPI is readable only through
`GET /campaigns/:id/kpi`; the project's through `useKpi`.

## Goals / Non-Goals

**Goals:**
- One rule for the indicator, reusing `kpiProgress`.

**Non-Goals:**
- Indicators on ad sets or ads, which carry no KPI.
- Configurable thresholds.

## Decisions

- **Campaign responses include `kpi`.** The campaign row already holds `kpi_metric` and
  `kpi_target`; mapping them in the campaign repository avoids N KPI requests. The target is
  a four-decimal string like the KPI endpoint's.
- **Tone lives with the page, not an entity.** `campaignTone(campaign, kpi, range)` imports
  both the campaign and KPI entities, which entities may not do to each other; it sits in
  `pages/project`, the only screen that colours campaigns.
- **Tones `idle | danger | stable | profitable`.** The table maps them to grey, red, blue and
  green borders and exposes the tone as `data-tone` for tests and assistive text.
- **Running means ACTIVE or LEARNING.**

## Risks / Trade-offs

- [Prorated monthly targets early in a month] → same rule as the KPI tiles, so both agree.

## Migration Plan

No schema change.
