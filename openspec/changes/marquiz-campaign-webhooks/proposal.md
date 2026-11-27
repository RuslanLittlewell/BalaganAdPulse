## Why

A member who works the CRM by campaign sees only the leads of the chosen campaigns. A Marquiz
lead reaches a campaign only when its `utm_campaign` equals the campaign's name or id, and many
quizzes send no such tag, so their leads stay outside every campaign and the member does not see
them. Each campaign usually has a quiz of its own, so the member should connect the quiz to the
campaign directly.

## What Changes

- A Marquiz webhook can carry a campaign in its address, after the project's website key. A lead
  from that address is linked to that campaign, whatever its `utm_campaign` says.
- A campaign in the address that the key's project does not hold does not refuse the lead: the
  lead is created and linked by `utm_campaign` as before.
- The project address without a campaign keeps working as it does now.
- When the board's project has CRM by campaign on, the Marquiz tab of the CRM integrations
  window asks for a campaign of the board's project and gives that campaign's address. It
  preselects the campaign when exactly one is chosen in the CRM menu. When the setting is off,
  the tab gives the project address as before.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `website-lead-intake`: a Marquiz webhook address can name a campaign of the project, and the
  Marquiz tab gives one address per campaign when the project is worked by campaign.

## Impact

- API: `POST /api/intake/marquiz/:key/:campaignId` beside the project address, a campaign lookup
  in the key's project, and the OpenAPI entry.
- Web: a campaign select in the Marquiz panel, the project's CRM by campaign setting and the menu's
  campaign choice passed to it from the integrations window, Russian and English copy.
- No schema change and no new dependency.
