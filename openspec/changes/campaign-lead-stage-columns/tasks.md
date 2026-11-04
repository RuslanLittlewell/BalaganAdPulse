## 1. Board stage counts API

- [x] 1.1 Add the `BoardStageCounts` type and a pure function that folds `(campaignId, adId, stage)` groups and an ad-to-ad-set map into campaign, ad set and ad lists, sorted by id, to the leads domain
- [x] 1.2 Extract the arrival window filter shared with the project counts, and add `boardStageCounts(actor, board, window)` to the `LeadRepository` port and `PrismaLeadRepository` (one `groupBy` on the board's leads, one read of the listed ads' ad sets)
- [x] 1.3 Add the `boardStageCounts` use case (range check, `authorize(actor, board, "read")`) and `GET /boards/:boardKey/stage-counts` with the existing range schema and an OpenAPI entry
- [x] 1.4 Cover the folding function in a domain test, and grouping by campaign, ad set and ad, a lead without an ad, a hand-made lead, custom columns, the range edges, a Meta lead imported after the range, an unreachable board, the CRM module off, an invalid range and the OpenAPI entry in an API test; run `npm test`

## 2. Web

- [x] 2.1 Add `leadsApi.boardStageCounts`, the `BoardStageCounts` type and `useBoardStageCounts(boardKey, period, { enabled })` to the lead entity
- [x] 2.2 Add the `crm.column.*` copy to `ru.ts`, remove `dashboard.crmColumn`, and add a stage column helper beside `resultTypeColumns` that builds the `crm-<STAGE>` extra columns and a row's figures
- [x] 2.3 Switch the dashboard project table to the helper with all four stages
- [x] 2.4 Offer Квал. лид, Целевой лид and КП in the project page's campaign table while CRM is on, with per-campaign counts and summed totals
- [x] 2.5 Offer the same columns in the campaign page's ad set table while CRM is on, with per-ad-set and per-ad counts
- [x] 2.6 Cover the renamed dashboard columns, the campaign table's counts and totals, the ad set and ad rows, the hidden default, the missing Новый column and CRM off in web tests; run `npm run test:web` and `npm test`
