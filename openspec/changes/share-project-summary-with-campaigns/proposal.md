## Why

A member configures the period summary on a project page and then opens one of its campaigns, where a separately configured summary appears. Campaigns are read in the context of their project, so the summary should stay as the member arranged it for projects rather than asking for a second arrangement.

## What Changes

- The campaign page shows the tiles the member chose for the project page, with the campaign's own figures and KPI.
- The campaign page no longer offers the placeholder or the tile dialog; tiles are chosen on the project page.
- **BREAKING** A campaign page tile choice saved earlier is no longer read.

## Capabilities

### New Capabilities

### Modified Capabilities
- `summary-tiles`: the campaign page follows the project page's tile choice and offers no configuration.

## Impact

- Web only: the period summary widget gains a non-configurable mode, the campaign page uses the project page's choice, and the stored campaign choice is ignored. No API changes.
