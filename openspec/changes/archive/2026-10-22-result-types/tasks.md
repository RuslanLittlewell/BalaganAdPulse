## 1. API

- [x] 1.1 Add `optimization_goal` to `ad_set`; read it from Meta and save it on every import.
- [x] 1.2 Map goals to result types; report `resultType` on ad sets and ads and `resultTypes` on campaigns, with their OpenAPI schemas.

## 2. Web

- [x] 2.1 Carry the types in the campaign API types and labels in `ru.ts`.
- [x] 2.2 Add the «Тип результата» column and the by-type results cell to the performance table, and feed them from the project and campaign pages.

## 3. Verification

- [x] 3.1 Cover the importer, the mapping, the responses and the table.
- [x] 3.2 Run `npm test` until green; `openspec validate result-types --strict`.
