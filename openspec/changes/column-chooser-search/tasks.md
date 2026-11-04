## 1. Shared search field

- [x] 1.1 Add `MenuSearch` and `matchesSearch` to `shared/ui`, with the field markup, key handling and down arrow, and switch `MultiSelect` to them
- [x] 1.2 Cover `matchesSearch`, the focus staying in the field and the down arrow in `MenuSearch` tests, and keep the `MultiSelect` tests green; run `npm run test:web`

## 2. Column chooser

- [x] 2.1 Put `MenuSearch` at the top of the performance table's column chooser, filter `choices` with `matchesSearch`, say Ничего не найдено when nothing matches, and clear the text when the chooser closes
- [x] 2.2 Cover narrowing, case and spaces, no match, typing staying in the field, turning a found column on, the down arrow and opening again in the performance table tests; run `npm run test:web` and `npm test`
