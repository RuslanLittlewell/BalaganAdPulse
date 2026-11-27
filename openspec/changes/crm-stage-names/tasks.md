## 1. API

- [x] 1.1 Add the `lead_stage_name` table to the Prisma schema with its migration
- [x] 1.2 Read and store a board's stage names in the lead repository; list fixed stages with the board's name and `renamed`; take a name for `QUALIFIED`, `TARGET` and `PROPOSAL` in the column update, refuse every other change to a fixed stage, check names against the board's stage names, remove the row for the original name, record the rename in the audit trail; use the board's names in the lead history and the leads of a person or an organization; OpenAPI
- [x] 1.3 Cover it with tests: a rename, `NEW` refused, other boards untouched, back to the original name, uniqueness both ways, the audit entry, the lead history and the related leads

## 2. Web

- [x] 2.1 Show the board's name of a renamed fixed stage through `leadColumnLabel`; offer Переименовать in the column menu of `QUALIFIED`, `TARGET` and `PROPOSAL` for members who may update the board, and only that; fill the name dialog with the shown name
- [x] 2.2 Cover it with tests: renaming a fixed stage from a menu that offers nothing else, no menu on Новый, a stage name the board already uses refused, a renamed stage shown under the board's name and an unrenamed one in the interface language

## 3. Close

- [x] 3.1 Run `npm test`, the web tests and the type-checks until green; `openspec validate crm-stage-names --strict`
