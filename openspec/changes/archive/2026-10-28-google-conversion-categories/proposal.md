## Why

A Google campaign reports one result type, conversions, so its table offers a single extra column,
«Результаты - Конверсии», that adds every conversion of the account together. A Google Ads account
sorts its conversion actions into categories (lead forms, calls, contacts, directions, purchases),
and the media buyer wants to see each of them, including the calls from ads and the directions
that Google counts only among «Все конверсии».

## What Changes

- The Google import records the categories of the account's enabled conversion actions and, for
  each campaign, ad group and ad and each day, all its conversions in each category.
- Each Google category is reported as a result type. New types: qualified leads, calls, contacts,
  appointments, directions, purchases, checkouts and sign-ups; lead forms read as leads, page views
  as landing page views, outbound clicks as link clicks, downloads as app installs.
- A Google campaign reports the types of its account's categories instead of conversions, and its
  ad groups and ads carry their results by type, so the campaign and ad group tables show one
  «Результаты - <тип>» column per category.
- **BREAKING** A Google figure's results become all its conversions, the sum of its categories,
  rather than the conversions counted towards the campaigns' goals. KPIs on results and the cost
  per result of Google projects follow.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `result-types`: Google categories are result types; a Google campaign, ad group and ad report
  their results by category.
- `google-ads-project-integration`: the import reads all conversions and their categories.

## Impact

- Prisma: `campaign.conversion_categories`, and `campaign_daily_result`, `ad_set_daily_result`,
  `ad_daily_result` holding a day's results per category.
- API: `modules/integrations` (three more Google queries, the snapshot, its persistence),
  `modules/campaigns` (result types, typed figures of Google campaigns, ad groups and ads).
- Web: the new result types and their Russian names.
- Google campaigns imported before the change keep reporting conversions until their next import;
  the breakdown covers the days that import reads, the last 30.
