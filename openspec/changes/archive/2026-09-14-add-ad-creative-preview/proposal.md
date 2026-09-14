## Why

A media buyer judging a campaign sees only names, formats and figures: the picture the audience actually saw is missing, so deciding which ad to keep means leaving AdPulse for Ads Manager. The creative belongs beside the numbers it produced.

## What Changes

- Import each Meta ad's creative — images, carousel frames and video — alongside the campaign hierarchy, keeping its external identifier.
- Store a copy of every creative in the project's own object storage, so a preview keeps working after the token expires, the ad is paused or the ad is deleted in Meta.
- Show a preview in the ad set's table: clicking an ad opens a dialog with that ad's creative and lets the buyer page through every ad of the same ad set without closing it.
- Play video creatives in the dialog; a video too large to copy keeps its poster frame and a link out to Ads Manager.
- Serve creative files through the API under the same reach rules as the ad they belong to, never as a public link.
- No breaking API changes.

## Capabilities

### New Capabilities

- `ad-creatives`: the pictures and videos an ad was shown with, kept beside its figures and previewed from the campaign screen.

### Modified Capabilities

- `meta-project-integration`: the import also carries each ad's creative and copies its files into storage.

## Impact

The Meta provider and import job, a new creative model with its migration and object-storage keys, the campaign screen's ad set table, a new preview dialog, Russian localization and the OpenAPI document. Existing campaign, ad set, ad and metric contracts stay as they are.
