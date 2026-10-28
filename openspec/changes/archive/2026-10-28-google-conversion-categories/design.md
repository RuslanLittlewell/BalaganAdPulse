## Context

The Google import asks for cost, impressions, clicks, `metrics.conversions` and the conversion
value of each campaign, ad group and ad per day, and stores them in the same daily tables as Meta,
with results equal to conversions. A result type comes from a Meta ad set's optimization goal;
`kindsOf` hard-codes conversions for a Google campaign, `readTypedDays` turns each Google campaign
day into one conversions row, and Google ad groups and ads, which have no goal, report unknown. The
web builds the extra columns of the campaign and ad group tables from the campaign's
`resultTypes`, and each row's cells from its own `performance.resultTypes`.

## Goals / Non-Goals

**Goals:**
- One «Результаты - <тип>» column per Google conversion category, on the project's campaign table
  and the campaign's ad group and ad tables.
- Counts as Google's «Все конверсии», so calls from ads and directions are seen.

**Non-Goals:**
- A column per conversion action.
- Splitting spend between categories.
- Backfilling more than the 30 days an import reads.

## Decisions

- **Categories map onto result types.** A Google category is stored as Google names it and mapped
  when read, as a Meta goal is. Categories that mean what an existing type means reuse it (lead
  forms are leads, page views are landing page views), so a project with Meta and Google campaigns
  gets one leads column for both; the others become new types. Mapping at read time lets the
  mapping change without re-importing.
- **Three daily result tables.** `campaign_daily_result`, `ad_set_daily_result` and
  `ad_daily_result` hold one row per entity, day and category, with the conversions as a
  four-decimal number, since Google's attributed conversions are fractional. They follow the daily
  metric tables: keyed by entity and day (and category), cascading with the entity, replaced over
  the import's window in the same transaction. One table per level keeps the foreign keys the
  metric tables have.
- **The query segments by category.** `segments.conversion_action_category` with
  `metrics.all_conversions` at each level gives the counts without fetching each action; zero rows
  are skipped. The enabled categories come from `conversion_action` and are stored on each campaign
  of the account, together with the categories its results hold, so a type with no conversions in
  the period still has its column.
- **Each type of a Google entity costs its whole spend.** Google cannot say what part of a
  campaign's spend bought a contact, so «Цена · Контакты» is the spend over the contacts, as Google
  Ads computes a cost per conversion action. Rows of one entity and day are grouped by type before
  the spend is attached, so two categories of one type do not count the spend twice.
- **Results become all conversions.** The sum of a Google entity's categories is all its
  conversions; keeping `results` at the goal conversions would make «Результаты» disagree with the
  columns beside it. `conversions` stays the goal conversions.
- **Old Google campaigns keep conversions until imported.** A campaign with no recorded
  categories keeps reporting conversions from its results, so a project reads the same until its
  next daily import.

## Risks / Trade-offs

- [KPIs on results of Google projects jump from goal conversions to all conversions] → stated in
  the proposal as breaking; a KPI meant for goal conversions can be set on «Лиды», which still
  counts them.
- [Days before the first import with categories have no breakdown] → those days keep their
  results but show dashes by type; the window fills in over the next imports.
- [Three more queries per Google import] → each returns at most one row per entity, day and
  category over 30 days, within the existing row and page limits.
