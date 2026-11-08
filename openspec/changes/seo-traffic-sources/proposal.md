## Why

The SEO tab shows how a site does in Google search, but not where its visitors come from. Search Console counts only clicks from Google search. A member who wants to know how much traffic comes from direct visits, social networks, ads, referrals and other search engines has to open Google Analytics by hand. The site's tab should answer that next to the search figures.

## What Changes

- A connected site can be linked to one Google Analytics 4 property. The Google sign-in that connects a site asks for read-only access to Analytics as well, and the window that lists the Search Console sites also lists the GA4 properties, so the member picks both at once. A site connected without a property can be linked later from its panel with a second sign-in.
- The server imports the property's sessions every day, split by channel group and by source and medium.
- The SEO tab gets a Источники трафика block:
  - sessions per channel for the period, with the share of all sessions and the change against the previous period;
  - the top sources and mediums, such as `google / organic` and `t.me / referral`;
  - sessions per day.
- A site without a linked property shows a prompt to link one, to members who may manage integrations. Others see that no traffic data is connected.
- While the first import runs, the block shows a loader.
- Unlinking the property deletes its traffic data and leaves the Search Console connection untouched.

## Capabilities

### New Capabilities

- `site-traffic-sources`: linking a Google Analytics 4 property to a site, importing sessions by channel and by source and medium, reading them, and showing them in the SEO tab.

### Modified Capabilities

## Impact

- **API.**
  - The `seo` module gets a traffic model, a GA4 client, an import step and routes under `/api/projects/:id/seo/sites/:siteId/analytics` and `.../traffic`.
  - Every Search Console sign-in asks for `analytics.readonly` together with `webmasters.readonly`. A third purpose serves linking a property to a site that has none.
  - The daily worker loop imports traffic after the search figures.
- **Configuration.** The Google Cloud project needs the Analytics Data API and the Analytics Admin API enabled, and the new scope on the OAuth consent screen. Google may verify the consent screen again.
- **Web.** One new widget block in `widgets/seo-overview`, a property picker in the site's panel, and Russian copy in `ru.ts`.
- **Order of work.** This change builds on `seo-search-console`, which has to be archived first.
- **Data.** Google Analytics shows only what its tag recorded. A site without the tag has a property with no sessions, and the block says so.
