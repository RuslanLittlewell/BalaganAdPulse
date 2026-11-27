## Why

CRM by campaign is a switch in each member's profile, kept in their browser. Whether a project's
leads are worked by campaign depends on the project and its client, not on the member: one
project runs a quiz per campaign, another runs one form for everything. Today every member has to
turn the switch on for themselves, on every browser, and it then applies to every project.

## What Changes

- CRM by campaign becomes a setting of the project, off by default and stored on the server.
- A switch labelled CRM по кампаниям sits to the right of the Интеграции button in the CRM header.
  It shows and changes the setting of the selected board's project, for members who may manage
  the board's columns. It saves at once.
- When a project has the setting on, every member who opens its board gets the campaign select in
  the CRM menu, and the Marquiz tab gives an address per campaign.
- **BREAKING** for members who turned the profile switch on: the switch leaves the profile
  settings, the browser preference is no longer read, and every project starts with the setting
  off.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `crm-navigation`: the campaign select follows the project's CRM by campaign setting, which a
  switch beside Интеграции changes.
- `profile-preferences`: General no longer holds the CRM by campaign switch.

## Impact

- Database: a `campaign_crm` column on `project`.
- API: the boards list carries `campaignCrm`, and `PATCH /api/crm/boards/:boardKey` changes it,
  with an audit entry and OpenAPI.
- Web: a switch in the CRM header, the campaign scope read from the board, the profile switch and
  its browser preference removed, Russian and English copy.
- The `marquiz-campaign-webhooks` change reads the project's setting instead of the member's
  preference; its artifacts are updated to say so.
- This change modifies the requirement that `crm-campaign-multi-select` rewrites, so it is
  archived after that change.
