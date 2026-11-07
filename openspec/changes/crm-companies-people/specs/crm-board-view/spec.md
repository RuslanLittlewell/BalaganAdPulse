## MODIFIED Requirements

### Requirement: Cards show the chosen fields as icon rows

A lead's board card SHALL show the lead's name beside a letter avatar, then one row for each card field chosen in Options, in the chosen order. Each row SHALL begin with an icon for its field and SHALL carry no label; the field's name SHALL be available to assistive technology. Контакт, Организация, Номер телефона, Email, Telegram, Мессенджер and Сайт SHALL show the values of the lead's linked contact and organization. The default card fields SHALL be Сумма сделки, Ответственный, Организация, Номер телефона, Дата поступления and Метки. Any custom field of the board SHALL be choosable. A field without a value SHALL produce no row. Values SHALL be shown this way:
- Ответственный as an avatar and a name.
- Метки and list values as colored chips.
- Флажок as a checked mark.
- Дата поступления and Дата values as `ДД.ММ.ГГГГ`.
- Amounts and numbers without trailing zeros.

Long values SHALL truncate. The card SHALL NOT show the lead's campaign or that the lead came from Meta. On a card, Источник SHALL show only text a member entered. In compact mode a card SHALL show its name only. Pressing a phone, email or link on a card SHALL NOT start a drag or open the lead. Clicking a card, or pressing Enter or Space on it, SHALL open the lead's side panel.

#### Scenario: The default card
- **WHEN** a lead has the amount 50000.0000, the assignee Мария, the organization Ромашка, a contact with no phone, and the tag VIP, and arrived on 10.03.2026
- **THEN** its card shows the name, then rows for 50000, Мария, Ромашка, 10.03.2026 and VIP, and no phone row

#### Scenario: A custom field on the card
- **WHEN** a member adds the custom field Сегмент to the card fields
- **THEN** cards of leads holding a Сегмент value show it as a colored chip in the chosen place

#### Scenario: Compact cards
- **WHEN** a member turns on compact cards
- **THEN** every card shows only the lead's name and avatar

#### Scenario: A contact's phone changes
- **WHEN** the phone of Анна, the contact of two leads, changes
- **THEN** both leads' cards show the new phone

### Requirement: The view bar offers search, Filter, Sort and Options

Above the leads the CRM SHALL show a view bar, with the board picker in the CRM menu column beside it. The view bar SHALL hold a search field and the controls Фильтр, Сортировка and Настройки. Search SHALL keep only leads whose name, tags, contact's name, phone, email, Telegram or messenger, or organization's name contain the typed text, without regard to case. These controls SHALL be available to every member who can read the board, guests included. The view bar SHALL apply to every layout of the leads.

#### Scenario: Searching
- **WHEN** a member types ромаш in the search field
- **THEN** only leads whose name, organization, contact or tags contain ромаш stay on the board, and the column totals follow

### Requirement: Options choose the layout and the card

Настройки SHALL offer:
- Раскладка, with Канбан, Календарь and Таблица.
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
