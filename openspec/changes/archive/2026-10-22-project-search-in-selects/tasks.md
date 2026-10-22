## 1. Search

- [x] 1.1 Add a searchable select and a search option to the multiple select in `shared/ui`.
- [x] 1.2 Use them where a project is chosen: the report filter, the new report dialog, the task form, the task board's project filter and the activity log's filters.
- [x] 1.3 Put a search icon inside the project list's search field.

## 2. Verification

- [x] 2.1 Cover narrowing, Enter, the empty result, resetting on close and keeping typing out of the list's own letter search.
- [x] 2.2 Run `npm run test:web` until green; `openspec validate project-search-in-selects --strict`.
