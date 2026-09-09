## Why

The fixed period shortcuts prevent users from inspecting an exact reporting interval. The shared period control needs explicit start and end dates so every metrics screen can query the range the user chooses.

## What Changes

- Replace the 7-day, 30-day, 90-day, current-month and previous-month buttons with two date inputs labelled “От” and “До”.
- Open the existing shadcn/ui calendar from each input and allow direct keyboard entry of valid dates.
- Keep the chosen inclusive range in the URL so dashboard, project and campaign screens share it and browser navigation preserves it.
- Validate the range before changing metrics queries and present Russian feedback for invalid or reversed dates.
- No breaking API changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `campaign-metrics`: Users can select an exact inclusive reporting range in every metrics view.

## Impact

The shared period feature, its URL state, Russian localization, existing shadcn/ui DatePicker usage and frontend tests. Backend range contracts remain unchanged.
