## Why

Leads that start on a client's website never reach the CRM. Meta only returns leads from its own lead forms, and campaigns that send traffic to a site (Gealan's four active campaigns, for example) report pixel events that the CRM cannot see. The CRM also stores no UTM tags, so a lead cannot be tied to the campaign that produced it.

## What Changes

- Each project gets one website key. Administrators and managers create, rotate and remove it, and list the sites allowed to use it.
- A script served by the API, added to a site with one tag, keeps the visitor's UTM tags, finds forms that collect a phone or email, and sends the lead to the CRM when a form is submitted. A function lets a site send a lead from its own code.
- A public intake endpoint accepts those leads, checks the key, the site's origin and limits, and creates a lead in the project's first column.
- A lead keeps its UTM tags, page and referrer. When `utm_campaign` matches a campaign of the project by Meta id or name, the lead is linked to that campaign.
- The lead card shows a source block with these values. Website leads are marked with their own origin.

## Capabilities

### New Capabilities

- `website-lead-intake`: the key, the script, the endpoint and the attribution.

### Modified Capabilities

- `lead-side-panel`: the card shows the website source block.

## Impact

API: Prisma schema and migration, a key repository and use cases, a public router and script route mounted before authentication, the lead read model. Web: a key panel in the project, the source block in the lead card. Access policy: a resource for the key.
