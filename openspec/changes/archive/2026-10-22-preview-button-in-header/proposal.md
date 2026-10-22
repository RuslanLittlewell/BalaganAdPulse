## Why

The «Превью» button sits beside the metrics, among the period controls. It belongs with the
other project-wide controls in the project header, and a single icon takes less room there.

## What Changes

- The preview button moves from the metrics heading to the project header, before the KPI-tracking
  switch and parted from it by a divider like the app header's buttons. It is drawn as the
  full-screen icon of video players, named «Превью» for assistive technology and in its tooltip.
- The «Выйти из превью» button shows the matching exit-full-screen icon.

## Capabilities

### New Capabilities

### Modified Capabilities
- `project-preview`: where the preview button is and how it looks.

## Impact

- `apps/web`: project header and project page. No API change.
