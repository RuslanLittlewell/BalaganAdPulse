## Purpose

Show a CRM board the way Twenty shows its stage board: dense columns with colored stage pills and totals, cards built from the fields a member chooses, inline creation, and a view bar with search, Filter, Sort and Options that each person tunes for each board.

## ADDED Requirements

### Requirement: Columns show a colored pill and their totals

The CRM SHALL appear in navigation at `/crm`. The board SHALL show its columns side by side, separated by thin dividers and without per-column panels, scrolling horizontally when they do not fit, with each column's cards scrolling vertically within the available height. Each column header SHALL show the column's name inside a pill in the column's color, the number of leads shown in the column, and, when at least one shown lead carries a deal amount, the sum of the shown leads' amounts in compact form. Totals SHALL count only the leads that pass the current search and filters. The fixed stages SHALL have the colors Новый синий, Квалифицированный фиолетовый, Целевой оранжевый and КП зелёный. The placeholder column Добавить столбец SHALL stay last for members who may manage the board's columns.

#### Scenario: A column's totals
- **WHEN** Новый holds three leads with the amounts 50000, 30000 and none
- **THEN** its header shows Новый in a blue pill, 3 and 80 тыс.

#### Scenario: A column with no amounts
- **WHEN** Целевой holds two leads without amounts
- **THEN** its header shows the orange Целевой pill and 2, and no sum

#### Scenario: Totals follow the filter
- **WHEN** a filter hides one of Новый's three leads
- **THEN** Новый's header counts 2 and sums only the two shown leads

### Requirement: Custom columns carry a color

A custom column SHALL carry one color from the palette серый, красный, оранжевый, жёлтый, зелёный, бирюзовый, синий and фиолетовый. A new column SHALL be серый. A member who may update leads on the board SHALL be able to change a custom column's color from the column menu. The column list SHALL report a color for every column, fixed stages included. A request that sets a color outside the palette, or a color on a fixed stage, SHALL be refused with 400. A color change SHALL be audited with the column and SHALL reach open boards like other column changes.

#### Scenario: Recoloring a column
- **WHEN** a member picks фиолетовый for the column Встреча
- **THEN** the Встреча pill turns purple on every open board of that project

#### Scenario: An unknown color
- **WHEN** a request sets a column's color to pink
- **THEN** the API responds 400 and the column is unchanged

### Requirement: Cards show the chosen fields as icon rows

A lead's board card SHALL show the lead's name beside a letter avatar, then one row for each card field chosen in Options, in the chosen order. Each row SHALL begin with an icon for its field and SHALL carry no label; the field's name SHALL be available to assistive technology. The default card fields SHALL be Сумма сделки, Ответственный, Компания, Номер телефона, Дата поступления and Метки. Any custom field of the board SHALL be choosable. A field without a value SHALL produce no row. Values SHALL be shown this way:
- Ответственный as an avatar and a name.
- Метки and list values as colored chips.
- Флажок as a checked mark.
- Дата поступления and Дата values as `ДД.ММ.ГГГГ`.
- Amounts and numbers without trailing zeros.

Long values SHALL truncate. The card SHALL NOT show the lead's campaign or that the lead came from Meta. On a card, Источник SHALL show only text a member entered. In compact mode a card SHALL show its name only. Pressing a phone, email or link on a card SHALL NOT start a drag or open the lead. Clicking a card, or pressing Enter or Space on it, SHALL open the lead's side panel.

#### Scenario: The default card
- **WHEN** a lead has the amount 50000.0000, the assignee Мария, the company Ромашка, no phone, and the tag VIP, and arrived on 10.03.2026
- **THEN** its card shows the name, then rows for 50000, Мария, Ромашка, 10.03.2026 and VIP, and no phone row

#### Scenario: A custom field on the card
- **WHEN** a member adds the custom field Сегмент to the card fields
- **THEN** cards of leads holding a Сегмент value show it as a colored chip in the chosen place

#### Scenario: Compact cards
- **WHEN** a member turns on compact cards
- **THEN** every card shows only the lead's name and avatar

### Requirement: Leads are created from a column

Each column SHALL end with + Новый for members who may create leads. Activating it SHALL show a name input at the end of that column. Pressing Enter with a nonblank name SHALL create the lead in that column, first in its order, raise the alert Лид создан and open its side panel. Pressing Escape or leaving the input empty SHALL create nothing. The header's Создать control SHALL ask for a name the same way, in either layout, and SHALL create the lead in Новый. A refused creation SHALL keep the typed name and show the reason.

#### Scenario: Creating in a custom column
- **WHEN** a member activates + Новый under Встреча, types Ромашка and presses Enter
- **THEN** a lead Ромашка is stored in Встреча, first in that column, and its panel opens

#### Scenario: Canceling creation
- **WHEN** a member types a name under + Новый and presses Escape
- **THEN** no lead is created and the input disappears

#### Scenario: A guest
- **WHEN** a guest opens the board
- **THEN** no + Новый and no Создать are offered

### Requirement: The view bar offers search, Filter, Sort and Options

Above the board the CRM SHALL show a view bar. On its left SHALL be the board picker, showing the selected board's name and number of leads. On its right SHALL be a search field and the controls Фильтр, Сортировка and Настройки. Search SHALL keep only leads whose name, company, phone, email, Telegram, messenger or tags contain the typed text, without regard to case. These controls SHALL be available to every member who can read the board, guests included. The view bar SHALL apply to the board and to the calendar alike.

#### Scenario: Searching
- **WHEN** a member types ромаш in the search field
- **THEN** only leads whose name, company, contacts or tags contain ромаш stay on the board, and the column totals follow

### Requirement: Filters narrow the board by field

Фильтр SHALL list the filterable fields: Название, Этап, Сумма сделки, Ответственный, Компания, Метки, Услуга, Номер телефона, Telegram, Мессенджер, Email, Сайт, Источник, Дата поступления and every custom field of the board. After a field is picked, the member SHALL choose an operator and a value. Operators depend on the field:

| Fields | Operators |
| --- | --- |
| Text fields, Ссылка | содержит, не содержит, пусто, не пусто |
| Сумма сделки, Число | не меньше, не больше, пусто, не пусто |
| Дата поступления, Дата | в этот день, раньше, позже; Дата also пусто, не пусто |
| Этап, Ответственный, Список | любой из, ни один из; Ответственный and Список also пусто, не пусто |
| Метки, Несколько из списка | содержит любой из, не содержит ни одного из, пусто, не пусто |
| Флажок | отмечен, не отмечен |

Each condition SHALL appear as a chip naming the field, operator and value, and SHALL be editable and removable from its chip. All conditions SHALL apply together. Сбросить SHALL remove every condition and the search text. Leads that fail a condition SHALL be hidden but not changed. A condition naming a custom field or column that no longer exists SHALL be dropped without an error.

#### Scenario: Two conditions
- **WHEN** a member filters Сумма сделки не меньше 10000 and Ответственный любой из Мария
- **THEN** only Мария's leads with at least 10000 stay on the board

#### Scenario: Filtering a custom list field
- **WHEN** a member filters Сегмент любой из Опт
- **THEN** only leads whose Сегмент is Опт stay on the board

#### Scenario: Removing a chip
- **WHEN** a member removes the Ответственный chip
- **THEN** the board shows every lead that passes the remaining conditions

#### Scenario: A deleted field
- **WHEN** a filter names the custom field Бюджет and the field is deleted
- **THEN** the condition disappears and the board shows the leads the remaining conditions allow

### Requirement: Sort orders cards within each column

Сортировка SHALL offer one sort at a time: by Название, Сумма сделки, Дата поступления, Компания, Ответственный, or a custom field of type Текст, Число, Дата, Ссылка, Список or Флажок, ascending or descending. A Список field SHALL sort by its options' order. The default SHALL be Вручную, the stored order of the column. While a sort is on:
- Cards in every column SHALL follow it, with leads that lack a value last.
- A card SHALL NOT be reordered by hand within its column.
- A card dropped into another column SHALL move there, and its place SHALL follow the sort.

The active sort SHALL show as a chip that can be changed or removed.

#### Scenario: Sorting by amount
- **WHEN** a member sorts by Сумма сделки, descending
- **THEN** each column lists its largest deals first and leads without an amount last

#### Scenario: Dragging while sorted
- **WHEN** a sort is on and a member drags a card within its column
- **THEN** the card returns to its sorted place and nothing is stored

### Requirement: Options choose the layout and the card

Настройки SHALL offer:
- Раскладка, with Канбан and Календарь.
- Поля карточки, which lists the built-in card fields and the board's custom fields with a switch each, and lets a member reorder the shown ones.
- Скрывать пустые колонки, which hides columns with no shown leads; the placeholder column stays.
- Компактные карточки.
- Поля доски, for members who may create leads on the board. It opens the board's field management.

Hidden fields SHALL stay listed so they can be switched back on.

#### Scenario: Hiding empty columns
- **WHEN** a member turns on Скрывать пустые колонки and a filter leaves КП without leads
- **THEN** КП is not shown until a lead passes the filter again

#### Scenario: Reordering card fields
- **WHEN** a member moves Компания above Сумма сделки in Поля карточки
- **THEN** every card shows the company row before the amount row

### Requirement: The view is remembered per person and board

The search text, filters, sort, card fields and their order, hiding of empty columns, and compact cards SHALL be remembered for the signed-in person and the selected board in this browser, and restored when that person returns to that board. Another board SHALL keep its own settings. Another person signing in on the same browser SHALL get their own settings. A person with nothing remembered for a board SHALL see no search, no filters, the manual order, the default card fields, empty columns shown and full cards. The layout SHALL be remembered per person, regardless of board.

#### Scenario: Returning to a board
- **WHEN** a member filters board A, opens board B, and returns to board A
- **THEN** board A shows the same filter, and board B showed its own settings

#### Scenario: Another person
- **WHEN** a different person signs in on the same browser and opens board A
- **THEN** board A shows their own settings, or the defaults if they have none
