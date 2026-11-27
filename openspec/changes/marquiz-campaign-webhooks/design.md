## Context

`POST /api/intake/marquiz/:key` turns a Marquiz submission into a website lead of the key's
project. The intake links a website lead to a campaign through `utm_campaign`: the tag must equal a
campaign's external id, or the name of exactly one campaign of the project. Marquiz lets the quiz
owner set only the webhook address, with no headers.

CRM by campaign is a setting of the project, changed by a switch beside Интеграции. With it on,
the CRM menu shows a campaign select, and the board, table and tasks show only the leads of the
chosen campaigns. The integrations window is a widget that can read the setting and the menu's
choice through `useCampaignScope`; the Marquiz panel is a feature and cannot import the widget.

## Goals / Non-Goals

**Goals:**

- Link every lead of a quiz to the campaign the quiz runs for, with no setup beyond pasting one
  address.
- Keep the project address and every quiz already set up with it working.

**Non-Goals:**

- Per-campaign addresses for the site script and its intake endpoint.
- A key or secret per campaign.
- Moving leads that arrived before the campaign address was set up.

## Decisions

- The campaign travels in the address as a path segment after the key:
  `POST /api/intake/marquiz/:key/:campaignId`. Marquiz cannot send a header, and the address
  already carries the key. A key per campaign was considered and rejected: it needs storage,
  rotation and a migration, while the project key already authorizes the project and the campaign
  only chooses where the lead goes inside it. Rotating the project key changes every campaign
  address, as it changes the project address.
- The campaign in the address wins over `utm_campaign`. The member bound the quiz to the campaign
  on purpose, and a quiz shared by several ads may carry the tag of another campaign. The lead
  still keeps its UTM tags as sent.
- A campaign the project does not hold does not refuse the lead. The campaign is looked up by id
  inside the key's project; when none matches, because the campaign was removed or the id belongs
  to another project, the lead is linked by `utm_campaign` as from the project address. Refusing
  would lose leads every time a campaign leaves the project, and Marquiz does not show failed
  deliveries to the quiz owner. Looking the id up inside the key's project means a forged id can
  never place a lead in another project or link it to a campaign outside it, and the answer does
  not reveal whether the id exists.
- The deduplication id stays per project. The same submission posted to the project address and to
  a campaign address still makes one lead.
- The Marquiz panel takes `byCampaign` and `campaignId` props. The integrations window passes the
  project's setting and the single campaign chosen in the menu, if exactly one is. The panel loads the
  project's campaign references itself through the campaign entity and orders the running ones
  first, as the menu does. With `byCampaign` off the panel is unchanged.
- The campaign is chosen with the searchable select the CRM board picker uses, each option marked
  with the running dot. The choice lives in the panel only; it does not change the menu's scope.

## Risks / Trade-offs

- [A member pastes a campaign address into a quiz that runs for several campaigns] → Every lead of
  that quiz goes to the one campaign. The tab names the campaign beside the address, and the hint
  says one quiz per campaign.
- [The project's setting is turned off after quizzes were set up with campaign addresses] → Both
  addresses keep working on the server, so every quiz keeps delivering to its campaign.
- [A campaign is removed and its quiz keeps posting] → The leads arrive linked by `utm_campaign` or
  without a campaign, and stay visible under all campaigns.
