## 1. Resize every column

- [x] 1.1 Add per-column widths to the column store, and copy for the resize handle to `ru.ts`.
- [x] 1.2 Extract the name column's separator into a reusable resizer and put it on every figure column header; compute the table width from the column widths.
- [x] 1.3 Add web tests: keyboard resize of a figure column changes its reported width, respects the minimum and is remembered per table.

## 2. Reorder figure columns

- [x] 2.1 Add a per-table column order to the store with a move-left/right action over the visible columns, and copy for the controls.
- [x] 2.2 Render figure columns in the remembered order in the header, rows and totals; add the hover/focus triangles to each figure header, omitting them at the edges.
- [x] 2.3 Add web tests: moving a column changes the header and row order, edges offer no move outward, the order is remembered, and a re-shown column returns to its place.
- [x] 2.4 Run `npm test` and `npm run test:web` until green; `openspec validate table-column-resize-and-reorder --strict`.
