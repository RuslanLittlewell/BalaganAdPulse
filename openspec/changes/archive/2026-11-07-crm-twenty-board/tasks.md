## 1. Column colors in the API

- [x] 1.1 Add `LeadColumn.color` with an additive migration, `FIXED_STAGE_COLORS` in the domain, a color on every entry of `boardColumns()`, and `color` in the column create and update schemas, checked against the palette and refused for fixed stages
- [x] 1.2 Document `color` in the OpenAPI column component and route bodies
- [x] 1.3 API tests: default gray, recoloring with audit and `crm.changed`, unknown color and fixed stage refused with 400, colors listed for fixed stages, and the migration giving existing columns gray

## 2. Column colors on the web

- [x] 2.1 Add `color` to `LeadColumn` in `entities/lead` and a `ColumnPill` that shares the option chip's color classes

## 3. View state and its rules

- [x] 3.1 Add `features/lead-view-options/model/viewState.ts`: the `ViewState` type, its defaults, and a persisted store keyed by person and board
- [x] 3.2 Add the pure rules in `features/lead-view-options/lib`: field catalogue (built-in plus custom), arrival time, `operatorsFor`, `matches`, `visibleLeads`, `compareBy`, `pruneState`
- [x] 3.3 Unit tests for every operator per type, search across name, company, contacts and tags, AND-combination, sort with missing values last, list sort by option order, pruning of deleted fields, options and columns, and separate state per person and board

## 4. Board

- [x] 4.1 Rebuild `widgets/crm-board` columns: thin dividers, the column pill with count and compact amount sum over visible leads, hiding empty columns, and the placeholder column
- [x] 4.2 Rebuild the board card: letter avatar and name, icon rows for the chosen fields in order with accessible names, chips for tags and lists, compact mode, contact links that neither drag nor open
- [x] 4.3 Add `boardPlacement` for drops over a filtered column and drops while sorted, and wire it into the drop handler
- [x] 4.4 Add + Новый with `NewLeadInput` per column, opening the created lead's panel, and a column menu entry Цвет with the palette
- [x] 4.5 Web tests: pills, counts and sums following filters; default and chosen card fields; compact cards; no Meta mention; creating from a column, canceling and refusal; guests without + Новый; drag mapping with a filter; sorted columns refusing reordering within a column; recoloring a column

## 5. Side panel

- [x] 5.1 Build `widgets/lead-side-panel`: docked aside with the `lead` address parameter, close and Escape, narrow-screen overlay, closing on board change, and nothing for unknown ids
- [x] 5.2 Build the panel header with the editable name, the stage pill and choice, and the menu with confirmed Удалить
- [x] 5.3 Build `InlineField` and the grouped Поля tab (Сделка, Контакты, Свои поля, Описание, Системные), reusing the type editors as controlled components, saving one key per request, updating the cache, and restoring on Escape or refusal
- [x] 5.4 Move Активность, Файлы and Доп. информация into the panel's tabs, and remove the old `LeadCard` dialog
- [x] 5.5 Web tests: opening and switching leads, reload with `lead` in the address, foreign ids, Escape order; stage change and deletion; groups and custom fields; per-field save, Escape, invalid values, refusals; read-only members; imported lead tabs; rewrite the old lead card tests against the panel

## 6. View bar and page

- [x] 6.1 Build `CrmViewBar`: board picker with count, search, Фильтр with field, operator and value pickers and chips, Сортировка with its chip, Настройки with Раскладка, Поля карточки (switches and order), Скрывать пустые колонки, Компактные карточки and Поля доски, and Сбросить
- [x] 6.2 Rebuild `pages/crm` around the view bar, the chosen layout and the panel. Remove the tabs and the Поля button, and make the calendar honor the view state and open the panel
- [x] 6.3 Add the Russian copy to `ru.ts`
- [x] 6.4 Web tests: filters per type, removing chips, Сбросить; sort chip; layout switch remembered per person; card fields reordering; hide empty columns; Поля доски only for those who may create; settings restored per board and per person; calendar filtered and opening the panel

## 7. Docs

- [x] 7.1 Update the README's CRM section for the board, panel, view bar and column colors
