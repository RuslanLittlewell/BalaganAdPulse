## Decisions

- **Columns only in the web.** The API keeps reporting types and typed figures; the tables stop
  using the campaign's type list for a column and the typed spend for cost columns.
- **The total cell is a number.** With a column per type the list of types in the «Результаты»
  cell repeats them; the cell goes back to the sum. The blended cost stays blank where types mix,
  as it would compare unlike results.
- **Labels.** A type column reads «Результаты - <тип>» so it sorts next to «Результаты» in the
  column menu and is not mistaken for another metric. KPI choices keep their type labels.
