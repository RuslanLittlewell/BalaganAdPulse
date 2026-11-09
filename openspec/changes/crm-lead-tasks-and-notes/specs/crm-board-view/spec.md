## RENAMED Requirements

- FROM: `### Requirement: Options choose the layout and the card`
- TO: `### Requirement: Options choose the card`

## MODIFIED Requirements

### Requirement: Filters narrow the board by field

Фильтр SHALL list the filterable fields: Название, Этап, Сумма сделки, Ответственный, Компания, Метки, Услуга, Номер телефона, Telegram, Мессенджер, Email, Сайт, Источник, Дата поступления and every custom field of the board. After a field is picked, the member SHALL choose an operator and a value. Operators depend on the field:

| Fields | Operators |
| --- | --- |
| Text fields, Ссылка | содержит, не содержит, пусто, не пусто |
| Сумма сделки, Число | не меньше, не больше, пусто, не пусто |
| Дата поступления, Дата | в этот день, раньше, позже, в период; Дата also пусто, не пусто |
| Этап, Ответственный, Список | любой из, ни один из; Ответственный and Список also пусто, не пусто |
| Метки, Несколько из списка | содержит любой из, не содержит ни одного из, пусто, не пусто |
| Флажок | отмечен, не отмечен |

The operator в период SHALL ask for two days, От and До, and SHALL keep the leads whose day lies between them, both days included. A period with only one day filled SHALL be saved as a condition that is not yet complete and SHALL filter nothing until both days are set; a До earlier than От SHALL be refused with the reason beside the field. The count of leads in the view bar SHALL follow the filters.

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

#### Scenario: Leads that arrived in October
- **WHEN** a member filters Дата поступления в период От 2026-10-01 До 2026-10-31
- **THEN** only leads that arrived on those days, 1 and 31 October included, stay on the board, and the lead count shows how many there are

#### Scenario: Leads of October in one stage
- **WHEN** a member adds Этап любой из Новый to the October period
- **THEN** the lead count shows how many new leads arrived in October

#### Scenario: A reversed period
- **WHEN** a member sets До earlier than От
- **THEN** the reason is shown beside the field and the board is not filtered by that condition

### Requirement: Options choose the card

Настройки SHALL offer:
- Поля карточки, which lists the built-in card fields and the board's custom fields with a switch each, and lets a member reorder the shown ones. The table layout uses the same fields as its columns.
- Скрывать пустые колонки, which hides columns with no shown leads; the placeholder column stays.
- Компактные карточки.
- Поля доски, for members who may create leads on the board. It opens the board's field management.

Hidden fields SHALL stay listed so they can be switched back on.

#### Scenario: Hiding empty columns
- **WHEN** a member turns on Скрывать пустые колонки and a filter leaves КП without leads
- **THEN** КП is not shown until a lead passes the filter again

#### Scenario: Reordering card fields
- **WHEN** a member moves Организация above Сумма сделки in Поля карточки
- **THEN** every card shows the organization row before the amount row

## ADDED Requirements

### Requirement: The layout is chosen in the CRM header

The CRM page SHALL show the layout tabs Канбан, Задачи and Таблица in its header, always visible, to every member who can read the board, guests included. Exactly one SHALL be shown at a time, and the tabs SHALL mark which one is selected. Настройки SHALL NOT offer a layout. The view bar's search and filters SHALL apply to every layout.

The chosen layout SHALL be remembered for that person in that browser and SHALL be the layout they return to, independently of which board is selected. A person who has never chosen, or whose remembered layout no longer exists, SHALL see Канбан.

#### Scenario: Switching to tasks
- **WHEN** a member picks Задачи in the header
- **THEN** the board is replaced by the tasks of the selected board's leads and Задачи is marked as selected

#### Scenario: The choice outlives the session
- **WHEN** a member who last used Таблица reloads the CRM page
- **THEN** Таблица is shown

#### Scenario: A first visit
- **WHEN** a member opens CRM having never chosen a layout
- **THEN** Канбан is shown

#### Scenario: A removed calendar
- **WHEN** a member whose remembered layout was Календарь opens CRM
- **THEN** Канбан is shown

#### Scenario: Switching boards keeps the layout
- **WHEN** a member on Задачи switches from client A's board to client B's
- **THEN** Задачи stays shown, now for client B's leads

#### Scenario: Settings has no layout
- **WHEN** a member opens Настройки
- **THEN** no Раскладка section is offered

### Requirement: The header offers the arrival period

The CRM header SHALL show the fields От and До beside the view bar, in every layout, to every member who can read the board. Filling them SHALL set the filter Дата поступления в период, and it SHALL show as a chip like any other condition. Emptying both fields SHALL remove that condition. The fields and the chip SHALL always show the same period. A До earlier than От SHALL show the reason beside the fields and filter nothing.

#### Scenario: October in the header
- **WHEN** a member enters От 01.10.2026 and До 31.10.2026 on the board layout
- **THEN** only leads that arrived on those days remain, the lead count shows how many, and the chip Дата поступления: в период 01.10.2026 – 31.10.2026 is listed

#### Scenario: The table
- **WHEN** a member switches to Таблица with the period set
- **THEN** the table lists the same leads

#### Scenario: Clearing the period
- **WHEN** a member empties both fields
- **THEN** the condition is removed and every lead shows again
