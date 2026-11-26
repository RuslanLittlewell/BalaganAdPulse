## Context

One Prisma filter decides which leads a partner sees. The lead list, a single lead, the stage
counts, the contacts and their lead counts, notifications and the live update check all build on
it, and today it keeps leads whose campaign is one of the partner's campaigns. A lead without a
campaign fails that test.

The partner rule for a lead's campaign treats every lead without a campaign as a new lead: it
gives it the partner's only campaign or refuses when the partner holds several. Once partners see
leads without a campaign, that rule would take a lead into a campaign on any edit, or refuse every
edit of a partner with two campaigns.

The `partner-campaigns` change, not yet archived, modifies the same requirement of
`partner-access`. This change's delta builds on that text.

## Goals / Non-Goals

**Goals:**

- Show a partner the project's leads without a campaign wherever their own leads appear.
- Let a partner work such a lead without it changing campaign.

**Non-Goals:**

- Notifying partners when a lead without a campaign arrives. Notifications they already receive
  cover these leads once they see them.
- Showing a partner leads without a campaign of projects they do not reach.

## Decisions

- The partner filter keeps a lead when its campaign is one of the partner's campaigns or it has
  none, still inside the partner's project. It is written as an `OR` in the shared filter, and the
  callers that spread it into a `where` add no `OR` of their own.
- The partner rule for a lead's campaign learns whether a lead is being created. On create it
  stays as it is. On update a lead without a campaign keeps none unless the request names one of
  the partner's campaigns. A lead that names a campaign still cannot lose it to a partner.
- The web app is unchanged. The partner's campaign select shows these leads under all campaigns,
  and the lead panel offers only the partner's campaigns.

## Risks / Trade-offs

- Every partner of a project now sees every lead without a campaign, including leads the agency
  entered by hand. The agency keeps a lead private only by giving it a campaign that no partner
  holds.
- This change must be archived after `partner-campaigns`, otherwise that change's text for the
  requirement would replace this one.
