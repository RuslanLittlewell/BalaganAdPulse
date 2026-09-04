Every implementation task follows TDD: add the focused failing test, observe it fail, then add the
minimum implementation.

## 1. Metric arithmetic (pure domain)

- [x] 1.1 Write failing domain tests for summing measured figures over a range, including empty ranges and gaps.
- [x] 1.2 Write failing domain tests for each derived ratio, and for the absent-not-zero rule on a zero divisor.
- [x] 1.3 Write the failing test proving a range's ratio is derived from summed figures, not averaged from daily ratios.
- [x] 1.4 Implement the framework-free metric domain: the measured figures, their sum, and the derived ratios.
- [x] 1.5 Run `npm test` — green.

## 2. Schema and persistence

- [x] 2.1 Write failing adapter tests for storing a day's figures, replacing a repeated date, and reading a range.
- [x] 2.2 Extend `Campaign` with channel, status, objective and external id; add the `Channel` and `CampaignStatus` enums.
- [x] 2.3 In one migration: drop the three sheet tables and the placeholder campaigns, then add `AdSet`, `Ad` and the three daily-metric tables with their (entity, date) uniqueness.
- [x] 2.4 Implement the Prisma adapters for campaigns, ad sets, ads and metrics, translating reach into the queries.
- [x] 2.5 Run `npm test` — green.

## 3. Reading the hierarchy

- [x] 3.1 Write failing application tests for reading a campaign, its ad sets and its ads, with reach checked before lookup.
- [x] 3.2 Write the failing test proving an unreachable ad answers 404 rather than 403.
- [x] 3.3 Write failing application tests for a project summary and an agency summary over a range, including a partial grant.
- [x] 3.4 Implement the campaign, ad-set, ad and summary use cases against focused ports.
- [x] 3.5 Run `npm test` — green.

## 4. HTTP surface

- [x] 4.1 Write failing HTTP tests for campaign, ad-set, ad and summary endpoints, including range validation.
- [x] 4.2 Implement the routers and Zod schemas; wire them in the composition root.
- [x] 4.3 Write the failing test proving every property, record and value address answers 404 for every role.
- [x] 4.4 Unmount the record and property routers and update the route-mount characterization.
- [x] 4.5 Run `npm test` — green.

## 5. Removing the sheet

- [x] 5.1 Write the failing test proving a created project has no campaigns.
- [x] 5.2 Remove the default-campaign seeding port from the projects module.
- [x] 5.3 Delete the `records` module, the property half of `campaigns`, and their tests.
- [x] 5.4 Remove `property`, `record` and `value` from the permission matrix and add `campaign` coverage for the hierarchy.
- [x] 5.6 Run `npm test` — green.

## 6. Web: entities and shared pieces

- [x] 6.1 Write failing entity tests for campaign, ad-set, ad and summary queries, and the range parameter.
- [x] 6.2 Implement the campaign entity's contracts and hooks; delete the campaign-sheet entity surface.
- [x] 6.3 Write failing tests for the metric-formatting helpers: currency, integers, percentages, ratios, and the absent case.
- [x] 6.4 Implement the formatters and the sparkline/area path helpers as pure functions.
- [x] 6.5 Run `npm run test:web` — green.

## 7. Web: the four screens

- [x] 7.1 Write failing tests for the dashboard: agency KPIs, the project table, and the source panel.
- [x] 7.2 Implement the dashboard screen using the app's own design tokens and components.
- [x] 7.3 Write failing tests for the project screen: KPIs, the campaign table and its totals row.
- [x] 7.4 Implement the project screen.
- [x] 7.5 Write failing tests for the campaign screen: KPIs, the daily chart, and ad sets expanding into ads.
- [x] 7.6 Implement the campaign screen.
- [x] 7.7 Write the failing test proving the period control changes the range every screen reads.
- [x] 7.8 Implement the shared period control and wire it through.
- [x] 7.9 Delete the campaign sheet widget, its tabs, its form dialog and the old project page.
- [x] 7.10 Add the Russian strings for every new label.
- [x] 7.11 Run `npm run test:web` — green.

## 8. Acceptance

- [x] 8.1 Confirm no source file outside the audit column references a property, record or value.
- [x] 8.2 Update the README where it describes the campaign sheet.
- [x] 8.3 Run `openspec validate rebuild-campaign-metrics --strict`.
- [x] 8.4 Run `npm test`, `npm run test:web`, `npm run build`, `npm run build:web` — all green.
