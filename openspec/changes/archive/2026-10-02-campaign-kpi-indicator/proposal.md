## Why

The campaign table colours each campaign by a fixed ROAS rule, which ignores the targets
the agency actually sets per campaign and per project, and paints paused campaigns as if
they were running.

## What Changes

- The indicator is decided by KPI progress for the period: red below 80%, blue from 80% to
  100%, green from 100%; grey for a campaign that is not running or has no KPI to measure.
- A campaign without its own KPI is measured against the project's.
- Campaign responses carry the campaign's KPI, so the table needs no request per campaign.
- The ROAS-based tone is removed.

## Capabilities

### New Capabilities

### Modified Capabilities
- `kpi-targets`: campaign indicators follow KPI progress.

## Impact

- API: campaign responses gain `kpi: { metric, target } | null`.
- Web: tone computation, the performance table's indicator, the project page.
