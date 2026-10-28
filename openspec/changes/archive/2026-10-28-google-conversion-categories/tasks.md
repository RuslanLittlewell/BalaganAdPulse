## 1. API

- [x] 1.1 Add `campaign.conversion_categories` and the three daily result tables to Prisma with a migration.
- [x] 1.2 Add the new result types and the mapping from Google categories.
- [x] 1.3 Google provider: read the enabled categories and all conversions by category at each level; results become all conversions.
- [x] 1.4 Persist the categories and the results by category with the snapshot, replacing the window.
- [x] 1.5 Report a Google campaign's types from its categories, and the typed figures of Google campaigns, ad groups and ads from their results by category.
- [x] 1.6 Cover the provider, the persistence and the typed figures with tests.

## 2. Web

- [x] 2.1 Add the new result types and their Russian names.
- [x] 2.2 Cover a Google campaign's category columns in the project and campaign tables.

## 3. Close

- [x] 3.1 Run the suites and type-checks until green; `openspec validate google-conversion-categories --strict`.
