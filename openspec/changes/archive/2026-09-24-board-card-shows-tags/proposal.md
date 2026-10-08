## Why

The board card's footer names where a lead came from, and for an imported lead that is the Meta
campaign — detail the team does not sort leads by. Tags are what they use to tell leads apart
at a glance, and they are only visible inside the lead card.

## What Changes

- The board card's footer shows the lead's tags where it showed the acquisition source. A lead
  with no tags shows nothing there.
- The board card no longer shows the acquisition source, so an imported lead's Meta campaign no
  longer appears on it. The source stays in the lead card's Источник field and the Meta data in
  its Доп. информация tab.

## Capabilities

### Modified Capabilities
- `lead-crm`: what a board card shows; the card no longer names the Meta campaign.

## Impact

- **Web** (`apps/web`): `widgets/crm-board/LeadCard.tsx`, its test and the CRM page tests; the
  now unused `crm.noSource` string. No API or data change.
