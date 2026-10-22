## Context

Three tables exist: the performance table (hierarchical, windowed, with resizable and
reorderable columns), the organizations table and the monthly reports list. Each renders
the array it is given, in the order it is given.

## Goals / Non-Goals

**Goals:** one sorting behaviour shared by all three tables; accessible headers.

**Non-Goals:** server-side sorting, remembering the sort between visits, multi-column
sorting.

## Decisions

- **Client-side, in memory.** Every table already holds its full list, so sorting is a
  pure function of rows, a column accessor and a direction. Nothing is persisted: a table
  opens in its natural order, which for some tables is meaningful (running campaigns first).
- **Three-step cycle: descending, ascending, off.** Descending comes first because a media buyer looks for the biggest figure first. The off state restores the natural
  order, so the default is never lost.
- **Empty values last in both directions.** `null` and `undefined` never lead the table,
  whichever way it is sorted.
- **Text compares with the Russian locale, numbers numerically, dates by timestamp.**
- **A shared hook and a shared header button.** `useTableSort` holds the active column and
  direction and returns the sorted rows; `SortableHead` renders the header label as a button
  and sets `aria-sort` on the column header. The button is rendered by the component itself,
  never passed in.
- **Performance table sorts siblings.** Sorting applies recursively to each `children` list,
  so the hierarchy is preserved. Totals stay in the footer.
- **Header controls coexist.** In the performance table the sort button takes the label's
  place; the resize handle and move buttons keep their positions.

## Risks / Trade-offs

- The windowed performance table recomputes visible rows after a sort; the scroll position
  is left as it is.
