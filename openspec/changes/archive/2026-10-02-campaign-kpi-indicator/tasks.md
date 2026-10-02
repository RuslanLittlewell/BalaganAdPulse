## 1. Campaign KPI in responses

- [x] 1.1 Map the campaign's KPI into campaign responses and OpenAPI.
- [x] 1.2 Add an API test: a campaign with a KPI lists it; one without lists null.

## 2. Indicator by KPI

- [x] 2.1 Add `campaignTone` with the thresholds and fallbacks, and an `idle` tone in the table; remove `performanceTone`.
- [x] 2.2 Use it on the project page with the project's KPI and the selected range.
- [x] 2.3 Add web tests for each tone, lower-is-better, the project fallback and no KPI.
- [x] 2.4 Run `npm test` and `npm run test:web` until green; `openspec validate campaign-kpi-indicator --strict`.
