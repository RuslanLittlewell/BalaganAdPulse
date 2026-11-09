## MODIFIED Requirements

### Requirement: Leads have a table layout

The CRM header SHALL offer Таблица next to Канбан and Задачи. The table SHALL list the leads that pass the search and filters:
- one row per lead;
- the name first and the stage as a colored pill;
- the chosen card fields as further columns, in their order.

Without a sort the rows SHALL follow the board order, column by column. With a sort, they SHALL follow the sort. Clicking a row SHALL open the lead's side panel.

#### Scenario: Leads as a table
- **WHEN** a member picks Таблица for a board with leads in Новый and КП
- **THEN** the leads are rows, Новый's before КП's, each with its stage pill and the chosen card fields
