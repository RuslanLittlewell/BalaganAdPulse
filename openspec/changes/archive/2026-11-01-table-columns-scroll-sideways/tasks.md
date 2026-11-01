## 1. Table

- [x] 1.1 Draw the figure columns at their chosen widths and size the table from them, without measuring the container
- [x] 1.2 Resize one column at a time through `setColumnWidth`; remove `fitWidths`, `resizedWidths`, `setColumnWidths` and the container measurement

## 2. Tests

- [x] 2.1 Replace the fitting tests: a narrow container keeps the chosen widths and the table is wider than it; widening a column leaves its neighbours' widths
- [x] 2.2 Remove the unit tests of the removed width functions

## 3. Check

- [x] 3.1 Scroll a wide table sideways on the stand and see the name column stay pinned
- [x] 3.2 Run the web tests and the type-check until green; `openspec validate table-columns-scroll-sideways --strict`
