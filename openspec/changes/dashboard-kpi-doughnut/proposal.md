## Why

The dashboard's KPI indicator is a half-circle gauge with a needle. The needle points at one number, the share of met projects, while the colored arc already shows all four groups, so the needle repeats the green part and a half circle wastes the card's space. A doughnut shows the same four shares on a full ring with the count in its middle.

## What Changes

- The Выполнение KPI за месяц indicator becomes a doughnut: a full ring split into the four groups in proportion to their counts, with the number of met projects out of all projects, such as 7 из 12, in its middle.
- The needle goes. The legend, the counts, the period of the month and the data stay as they are.
- With no projects the ring is grey and the middle reads a dash.

## Capabilities

### New Capabilities

### Modified Capabilities

- `kpi-overview`: the KPI indicator is a doughnut instead of a gauge. The requirement is renamed, its four groups are stated as the screen shows them, and the note Beside the gauge in the notices requirement follows.

## Impact

- **Web.** `widgets/agency-overview/KpiGauge.tsx` becomes `KpiDoughnut.tsx` and `KpiOverview` uses it. The dashboard tests keep their texts and roles.
- **API.** None.
- **Other specs.** `kpi-targets` and `dashboard-due-tasks` call the widget the KPI gauge. They keep that name, which now means this indicator.
