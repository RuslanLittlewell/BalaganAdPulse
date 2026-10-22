## 1. Shared sorting

- [x] 1.1 Add the comparison and the `useTableSort` hook to `shared/lib`: ascending, descending, off; empty values last; Russian-locale text.
- [x] 1.2 Add `SortableHead` to `shared/ui`, rendering its own button with `aria-sort` on the header cell; add the Russian copy to `ru.ts`.

## 2. The tables

- [x] 2.1 Performance table: sort every level by name or any figure column, keep the totals in the footer, keep resize and move controls working.
- [x] 2.2 Organizations table: sort by name, status, modules, members, first administrator and creation date.
- [x] 2.3 Reports list: sort by month, project, spend, leads, cost per lead and status.

## 3. Verification

- [x] 3.1 Cover the comparison, the hook, the header and each table's sorting.
- [x] 3.2 Run `npm run test:web` until green; `openspec validate table-column-sorting --strict`.
