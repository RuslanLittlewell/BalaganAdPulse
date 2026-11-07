## Why

The user wants the CRM to look and work like Twenty's Opportunities board ("By Stage" view). Our board looks different in several ways:
- It reuses the task board's heavy column panels.
- Cards show a fixed set of fields.
- A lead opens in a centered dialog that saves only on Сохранить.
- There is no filter, sort or choice of what a card shows.

In Twenty, each column header carries a colored stage pill and the column's totals. Cards are dense, with one icon per field. A lead opens in a side panel and each field saves on its own. A view bar offers working Filter, Sort and Options. This is the second of the CRM changes that follow Twenty (see the archived `crm-custom-fields`).

## What Changes

- **Board layout.**
  - Columns lose their panels and are separated by thin lines.
  - Each column header shows a colored pill with the column name, the number of leads shown and the sum of their deal amounts.
  - Each column ends with + Новый, which takes a name and creates the lead in that column.
- **Column colors.**
  - The four fixed stages have fixed colors.
  - Custom columns pick a color from the same eight-color palette as field options, through the column menu.
  - The column API gains a `color`.
- **Cards.**
  - A card shows the lead's name with a letter avatar, then one icon row per chosen field, with no labels.
  - The default fields are Сумма сделки, Ответственный, Компания, Номер телефона, Дата поступления and Метки.
  - Empty values produce no row. A compact mode shows the name only.
- **BREAKING (UI): side panel instead of the dialog.**
  - Clicking a card on the board or in the calendar opens a panel on the right, and the board stays usable.
  - The panel has the tabs Поля, Активность, Файлы and, for imported leads, Доп. информация.
  - Поля groups the fields into Сделка, Контакты, Свои поля, Описание and Системные.
  - A value is edited in place and saved on its own when the member leaves it or presses Enter. There is no Сохранить button.
  - The open lead is kept in the address, so a reload reopens it.
- **View bar.** The board picker is on the left. On the right are search, Filter, Sort and Options.
  - Filter adds conditions per field, with operators chosen by the field's type, including custom fields. Several conditions combine with AND and show as removable chips.
  - Sort orders cards inside each column by one field and direction. While a sort is on, cards cannot be reordered by hand within a column.
  - Options holds:
    - the layout choice (Канбан or Календарь), which replaces the current tabs;
    - which fields a card shows and in what order;
    - hiding empty columns;
    - compact cards;
    - the entry to the board's field management (Поля доски).
- **Memory.** Search, filters, sort and card options are remembered for each person and board in the browser. The layout is remembered for each person, as it is today.
- **Look.** The CRM adapts Twenty's layout and interaction to our own design: our colors, tones, type sizes and font stay. Nothing is copied from Twenty's code.

## Capabilities

### New Capabilities
- `crm-board-view`: The Twenty-style board: column headers with colors and totals, cards built from chosen fields, inline creation, the view bar with search, Filter, Sort and Options, and what is remembered.
- `lead-side-panel`: The side panel that shows and edits a lead: how it opens and closes, its tabs, grouped fields and saving per field.

### Modified Capabilities
- `lead-crm`:
  - The task-board look and the two-column lead card are removed and replaced by the new capabilities.
  - Columns gain a color.
  - Imported lead details move into the panel.
  - Creating a lead goes through + Новый.
- `lead-calendar`: The layout is chosen in Options instead of tabs, and the calendar honors search and filters.
- `lead-custom-fields`:
  - Field management opens from Options.
  - Custom values are edited inline in the panel.
  - Cards may show custom values chosen in Options.

## Impact

- **Database:** a `color` column on `lead_column` with default `gray`, added in an additive migration.
- **API module `leads`:**
  - The column create and update schemas accept `color`.
  - The column list returns a color for every column, fixed stages included.
  - The OpenAPI docs are updated.
- **Web:**
  - `widgets/crm-board` and `widgets/crm-calendar` are rebuilt.
  - New `features/lead-view-options` holds search, filter, sort and options together with their remembered state.
  - New `widgets/lead-side-panel` replaces `features/lead-management`'s dialog.
  - `pages/crm` gets the new view bar.
  - `ru.ts` gains the new copy.
- **Unchanged:** stage counts, Meta import and the dashboard.
