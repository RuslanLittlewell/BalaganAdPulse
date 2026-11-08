## Why

Media buyers judge a campaign by the leads it brought to the sales team, not only by the leads
Meta reports. The CRM already records how far each lead got, and the dashboard's project table
shows those counts per project, but the campaign table of a project and the ad set table of a
campaign do not. A buyer cannot see which campaign, ad set or ad brings qualified leads, target
leads or leads that reached a commercial proposal.

## What Changes

- The project page's campaign table offers three new columns in its column chooser: Квал. лид,
  Целевой лид and КП. Each cell shows how many of the campaign's leads arrived in the selected
  period and now sit in that fixed CRM stage. The columns are hidden until a member turns them
  on, and the choice is remembered with the table's other columns. The totals row sums the
  listed campaigns.
- The campaign page's ad set table offers the same three columns, for each ad set and for each
  ad under it.
- A lead counts for a campaign, ad set or ad through the campaign and ad its Meta import
  recorded. A lead created by hand names no campaign and counts in none of these rows.
- The dashboard's project table renames its columns Лид (Квалифицированный), Лид (Целевой) and
  Лид (КП) to Квал. лид, Целевой лид and КП. Лид (Новый) keeps its name. The counts and the
  members' saved column choices stay as they are.
- A new endpoint, `GET /api/crm/boards/:boardKey/stage-counts?from=&to=`, returns a project's
  period lead counts per fixed stage, grouped by campaign, ad set and ad.
- The requirement that the campaign tables do not offer CRM stage columns is withdrawn.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lead-crm`: period lead counts are also reported per campaign, ad set and ad of a project;
  the dashboard's stage columns are renamed; the project page's campaign table and the
  campaign page's ad set table offer Квал. лид, Целевой лид and КП.

## Impact

- API: a new read-only `GET /api/crm/boards/:boardKey/stage-counts` behind the CRM module gate,
  documented in OpenAPI. Existing endpoints are unchanged.
- Backend: the leads module (domain type, repository port and Prisma query, use case, schema,
  router, OpenAPI). No database change: the counts use the existing `campaign_id` and `ad_id`
  of `lead` and the `ad_set_id` of `ad`.
- Web: the lead entity (API call, query hook, column labels), the project page's campaign
  table, the campaign page's ad set table, the dashboard's project table and the Russian copy
  in `ru.ts`.
